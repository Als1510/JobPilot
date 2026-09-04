import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import YAML from 'yaml';
import { computeMatch, type ScoringWeights } from '@jobpilot/core';
import { createProvider, extractJobInfo } from '@jobpilot/ai';
import { getSource } from '@jobpilot/sources';
import {
  getAnalysis,
  getJobById,
  getJobMatch,
  getJobsWithoutAnalysis,
  listJobs,
  listRankedJobs,
  loadProfile,
  saveAnalysis,
  saveJobs,
  saveMatch,
  upsertProfile,
  disconnectDb,
} from './db';
import { profileYamlSchema, yamlToProfile } from './profile';

const here = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(here), '..', '..', '..');

function loadScoring(): Partial<ScoringWeights> {
  try {
    const raw = readFileSync(resolve(repoRoot, 'config', 'scoring.json'), 'utf8');
    const parsed = JSON.parse(raw) as { weights?: Partial<ScoringWeights> };
    return parsed.weights ?? {};
  } catch {
    return {};
  }
}

function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const program = new Command();
program.name('jobpilot').description('JobPilot - AI job search assistant (M1: Job Intelligence)').version('0.1.0');

// ---------------------------------------------------------------------------
// profile import
// ---------------------------------------------------------------------------
const profileCmd = program.command('profile').description('Candidate profile management.');

profileCmd
  .command('import')
  .description('Import the master candidate profile from a YAML file.')
  .argument('<file>', 'path to master profile YAML')
  .action(async (file: string) => {
    const abs = resolve(process.cwd(), file);
    const text = readFileSync(abs, 'utf8');
    const parsed = profileYamlSchema.parse(YAML.parse(text));
    const profile = yamlToProfile(parsed);
    const id = await upsertProfile(profile);
    console.log(`Profile imported. id=${id} skills=${profile.skills.length} name=${profile.name}`);
    await disconnectDb();
  });

// ---------------------------------------------------------------------------
// jobs fetch / ingest / list
// ---------------------------------------------------------------------------
const jobsCmd = program.command('jobs').description('Job discovery commands.');

jobsCmd
  .command('fetch')
  .description('Fetch new jobs from a source, normalize and dedupe.')
  .option('-s, --source <name>', 'job source', 'mock')
  .action(async (opts: { source: string }) => {
    const source = getSource(opts.source);
    console.log(`Fetching from ${source.name}...`);
    const raw = await source.fetchJobs();
    const { created, duplicates } = await saveJobs(raw);
    console.log(`Fetched ${raw.length} job(s) | added ${created} | duplicates/skipped ${duplicates}`);
    await disconnectDb();
  });

jobsCmd
  .command('ingest')
  .description('Manually add a job from a JD text file (normalizes + dedupes).')
  .argument('<file>', 'path to a text file containing the job description')
  .requiredOption('--title <title>', 'job title')
  .requiredOption('--company <company>', 'company name')
  .option('-l, --location <location>', 'location string')
  .action(async (file: string, opts: { title: string; company: string; location?: string }) => {
    const text = readFileSync(resolve(process.cwd(), file), 'utf8');
    const { created, duplicates } = await saveJobs([
      {
        source: 'manual',
        externalId: `manual-${hashText(text.slice(0, 200))}`,
        company: opts.company,
        title: opts.title,
        location: opts.location ?? null,
        remoteStatus: null,
        url: null,
        description: text,
        postedAt: new Date(),
      },
    ]);
    console.log(`Ingested ${created} job(s) (${duplicates} duplicate/skipped).`);
    await disconnectDb();
  });

jobsCmd
  .command('list')
  .description('List all stored jobs.')
  .action(async () => {
    const jobs = await listJobs();
    for (const j of jobs) {
      console.log(`${j.id.slice(0, 8)}  ${j.title.padEnd(28)} ${j.company.padEnd(22)} [${j.remoteStatus}] ${j.source}`);
    }
    console.log(`\nTotal: ${jobs.length}`);
    await disconnectDb();
  });

// ---------------------------------------------------------------------------
// analyze
// ---------------------------------------------------------------------------
program
  .command('analyze')
  .description('Extract structured info from job descriptions (LLM or fake).')
  .option('--job <jobId>', 'analyze one job by id')
  .option('--all', 'analyze all jobs without analysis')
  .action(async (opts: { job?: string; all?: boolean }) => {
    const model = createProvider();
    const picked = opts.job ? [await getJobById(opts.job)] : await getJobsWithoutAnalysis();
    const targets = picked.filter((j): j is NonNullable<typeof j> => Boolean(j));
    if (targets.length === 0) {
      console.log('No jobs to analyze.');
      await disconnectDb();
      return;
    }
    console.log(`Analyzing ${targets.length} job(s) with ${model.name}...`);
    for (const job of targets) {
      const extracted = await extractJobInfo(model, job.description, {
        context: { title: job.title, location: job.location, company: job.company },
      });
      await saveAnalysis(job.id, extracted, model.name);
      console.log(
        `  ✓ ${job.title}: required=${(extracted.requiredSkills ?? []).length} ` +
          `exp=${extracted.experienceYears ?? 'n/a'} ${extracted.remoteStatus}`,
      );
    }
    await disconnectDb();
  });

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------
program
  .command('match')
  .description('Compute deterministic explainable matches for analyzed jobs.')
  .option('--job <jobId>', 'match one job by id')
  .option('--all', 'match all analyzed jobs')
  .action(async (opts: { job?: string; all?: boolean }) => {
    const profile = await loadProfile();
    if (!profile) {
      console.error('No profile imported yet. Run: jobpilot profile import profiles/master.yaml');
      await disconnectDb();
      return;
    }
    const weights = loadScoring();
    const picked = opts.job ? [await getJobById(opts.job)] : await listJobs();
    const targets = picked.filter((j): j is NonNullable<typeof j> => Boolean(j));
    for (const job of targets) {
      const analysis = await getAnalysis(job.id);
      if (!analysis) {
        console.warn(`  skip "${job.title}": no analysis yet (jobpilot analyze --job ${job.id})`);
        continue;
      }
      const { result } = computeMatch({ jobId: job.id, job, analysis, profile, weights });
      await saveMatch(job.id, result);
      console.log(`  ✓ ${job.id.slice(0, 8)} ${job.title.padEnd(26)} ${result.totalScore}% strong=${result.isStrongMatch}`);
    }
    await disconnectDb();
  });

// ---------------------------------------------------------------------------
// rank / explain
// ---------------------------------------------------------------------------
program
  .command('rank')
  .description('List jobs ranked by match score.')
  .action(async () => {
    const ranked = await listRankedJobs();
    for (const r of ranked) {
      const score = r.totalScore === null ? '  -  ' : String(r.totalScore).padStart(5);
      const flag = r.isStrongMatch ? ' ★' : '';
      console.log(
        `${score}  ${r.job.title.padEnd(26)} ${r.job.company.padEnd(16)} ` +
          `${r.hasAnalysis ? 'analyzed' : 'no-analysis'}${flag}`,
      );
    }
    await disconnectDb();
  });

program
  .command('explain')
  .description('Show why a job scored the way it did.')
  .argument('<jobId>', 'job id')
  .action(async (jobId: string) => {
    const job = await getJobById(jobId);
    if (!job) {
      console.error(`No job with id "${jobId}".`);
      await disconnectDb();
      return;
    }
    const match = await getJobMatch(jobId);
    const analysis = await getAnalysis(jobId);
    console.log(`\n${job.title}  @  ${job.company}  (${job.remoteStatus}, ${job.location ?? 'no location'})`);
    if (!match) {
      console.log('No match computed yet. Run: jobpilot match --job ' + jobId);
    } else {
      console.log(`Overall: ${match.totalScore}/100 ${match.isStrongMatch ? '(STRONG MATCH)' : ''}`);
      for (const c of match.categoryScores) {
        console.log(`\n[${c.label}] contribution=${c.contributes} (raw ${c.rawScore}, weight ${c.weight})`);
        for (const r of c.reasons) console.log(`   - ${r}`);
      }
      console.log('\nSkills:');
      for (const s of match.matchedSkills) {
        console.log(`   ${s.matched ? '✓' : '✗'} [${s.kind.toLowerCase()}] ${s.skill}`);
      }
    }
    if (!analysis) console.warn('\n(no structured analysis stored)');
    await disconnectDb();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
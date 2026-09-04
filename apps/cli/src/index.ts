import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import YAML from 'yaml';
import { getSource } from '@JobPilot/sources';
import {
  analyzeJobs,
  computeMatches,
  disconnectDb,
  getAnalysis,
  getJobById,
  getJobMatch,
  ingestManualJob,
  listJobs,
  listRankedJobs,
  loadScoring,
  profileYamlSchema,
  recommendationFor,
  saveJobs,
  syncTrackedSources,
  upsertProfile,
  yamlToProfile,
} from '@JobPilot/service';

const program = new Command();
program.name('JobPilot').description('JobPilot - AI job search assistant (M1: Job Intelligence)').version('0.1.0');

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
  .command('sync')
  .description('Fetch jobs from all enabled tracked sources, normalize and dedupe.')
  .action(async () => {
    const summary = await syncTrackedSources({
      onSourceStart: (info) => console.log(`  Fetching from ${info.sourceName}...`),
    });
    for (const r of summary.results) {
      if (r.ok) {
        console.log(`  OK ${r.sourceType}/${r.identifier}: fetched ${r.fetched}, added ${r.created}, duplicates ${r.duplicates}`);
      } else {
        console.error(`  FAILED ${r.sourceType}/${r.identifier}: ${r.error}`);
      }
    }
    console.log(`Sync complete: ${summary.enabledCount} source(s) checked.`);
    await disconnectDb();
  });

jobsCmd
  .command('ingest')
  .description('Ingest a job description from a text file (manual source).')
  .argument('<file>', 'path to a text file containing the job description')
  .requiredOption('--title <title>', 'job title')
  .requiredOption('--company <company>', 'company name')
  .option('--location <location>', 'location string')
  .option('--url <url>', 'application URL')
  .action(async (file: string, opts: { title: string; company: string; location?: string; url?: string }) => {
    const text = readFileSync(resolve(process.cwd(), file), 'utf8');
    const { created, duplicates } = await ingestManualJob({
      content: text,
      title: opts.title,
      company: opts.company,
      location: opts.location,
      url: opts.url,
    });
    console.log(`Ingested "${opts.title}": created=${created} duplicates=${duplicates}`);
    await disconnectDb();
  });

jobsCmd
  .command('list')
  .description('List all stored jobs.')
  .action(async () => {
    const jobs = await listJobs();
    if (jobs.length === 0) {
      console.log('No jobs stored yet. Run: JobPilot jobs fetch');
      await disconnectDb();
      return;
    }
    for (const j of jobs) {
      console.log(`${j.id.slice(0, 8)}  ${j.title.padEnd(26)} ${j.company.padEnd(16)} ${j.remoteStatus.padEnd(8)} ${j.source}`);
    }
    await disconnectDb();
  });
﻿program
  .command('analyze')
  .description('Run AI extraction on jobs (stores JobAnalysis).')
  .option('--job <jobId>', 'analyze one job by id')
  .action(async (opts: { job?: string }) => {
    const outcomes = await analyzeJobs({ jobId: opts.job });
    if (outcomes.length === 0) console.log('No jobs left to analyze.');
    for (const o of outcomes) {
      console.log(`  OK ${o.jobId.slice(0, 8)} ${o.title}: ${o.requiredSkills} req / ${o.preferredSkills} pref skills`);
    }
    await disconnectDb();
  });

program
  .command('match')
  .description('Compute deterministic explainable matches for analyzed jobs.')
  .option('--job <jobId>', 'match one job by id')
  .action(async (opts: { job?: string }) => {
    const run = await computeMatches({ jobId: opts.job, weights: loadScoring() });
    if (!run.profileFound) {
      console.error('No profile imported yet. Run: JobPilot profile import profiles/master.yaml');
      await disconnectDb();
      return;
    }
    for (const o of run.outcomes) {
      if (o.kind === 'scored') {
        console.log(`  ${o.jobId.slice(0, 8)} ${o.title.padEnd(26)} ${o.totalScore}% strong=${o.isStrongMatch}`);
      } else {
        console.log(`  skip ${o.jobId.slice(0, 8)} ${o.title}: ${o.reason}`);
      }
    }
    await disconnectDb();
  });

program
  .command('rank')
  .description('List jobs ranked by match score.')
  .action(async () => {
    const ranked = await listRankedJobs();
    for (const r of ranked) {
      const score = r.totalScore === null ? '  -  ' : String(r.totalScore).padStart(5);
      const flag = r.isStrongMatch ? ' *' : '';
      console.log(`${score}  ${r.job.title.padEnd(26)} ${r.job.company.padEnd(16)} ${r.hasAnalysis ? 'analyzed' : 'no-analysis'}${flag}`);
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
      console.log('No match computed yet. Run: JobPilot match --job ' + jobId);
    } else {
      console.log(`Overall: ${match.totalScore}/100 ${match.isStrongMatch ? '(STRONG MATCH)' : ''}`);
      console.log(`Recommendation: ${recommendationFor(match)}`);
      for (const c of match.categoryScores) {
        console.log(`\n[${c.label}] contribution=${c.contributes} (raw ${c.rawScore}, weight ${c.weight})`);
        for (const reason of c.reasons) console.log(`   - ${reason}`);
      }
      console.log('\nSkills:');
      for (const s of match.matchedSkills) {
        console.log(`   ${s.matched ? 'matched' : 'missing'} [${s.kind.toLowerCase()}] ${s.skill}`);
      }
    }
    if (!analysis) console.warn('\n(no structured analysis stored)');
    await disconnectDb();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listJobs,
  getJobById,
  ingestManualJob,
  analyzeJobs,
  computeMatches,
  listRankedJobs,
  getJobMatch,
  getAnalysis,
  loadProfile,
  upsertProfile,
  importProfileFromYaml,
  syncTrackedSources,
  recommendationFor,
  disconnectDb,
} from '@JobPilot/service';

import { getSource } from '@JobPilot/sources';
import type { CandidateProfile, MatchResult } from '@JobPilot/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, '..', 'public')));

function formatExplain(job: any, match: MatchResult, analysis: any) {
  return {
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      remoteStatus: job.remoteStatus,
      url: job.url,
    },
    match: {
      totalScore: match.totalScore,
      isStrongMatch: match.isStrongMatch,
      recommendation: recommendationFor(match),
      categories: match.categoryScores,
      matchedSkills: match.matchedSkills,
    },
    analysis: {
      requiredSkills: analysis?.requiredSkills ?? [],
      preferredSkills: analysis?.preferredSkills ?? [],
      experienceYears: analysis?.experienceYears ?? null,
      remoteStatus: analysis?.remoteStatus ?? null,
      seniority: analysis?.seniority ?? null,
    },
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'JobPilot M1', time: new Date().toISOString() });
});

app.get('/api/jobs', async (_req, res, next) => {
  try {
    const jobs = await listJobs();
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

app.get('/api/jobs/:id', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

app.post('/api/jobs/fetch', async (req, res, next) => {
  try {
    const sourceName = req.body?.source ?? 'mock';
    const source = getSource(sourceName);
    const rawJobs = await source.fetchJobs();
    const { saveJobs } = await import('@JobPilot/service');
    const result = await saveJobs(rawJobs);
    res.json({ source: sourceName, ...result });
  } catch (err) {
    next(err);
  }
});

app.post('/api/jobs/ingest', async (req, res, next) => {
  try {
    const { content, title, company, location, url } = req.body ?? {};
    if (!content || !title || !company) {
      return res.status(400).json({ error: 'content, title, and company are required' });
    }
    const result = await ingestManualJob({ content, title, company, location, url });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/analyze', async (req, res, next) => {
  try {
    const jobId = req.body?.jobId as string | undefined;
    const results = await analyzeJobs({ jobId });
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

app.get('/api/match', async (req, res, next) => {
  try {
    const jobId = req.query.jobId as string | undefined;
    const outcomes = await computeMatches({ jobId });
    res.json(outcomes);
  } catch (err) {
    next(err);
  }
});

app.get('/api/rank', async (_req, res, next) => {
  try {
    const ranked = await listRankedJobs();
    res.json({ ranked });
  } catch (err) {
    next(err);
  }
});

app.get('/api/jobs/:id/explain', async (req, res, next) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const match = await getJobMatch(req.params.id);
    if (!match) return res.status(404).json({ error: 'No match found for this job. Run match first.' });
    const analysis = await getAnalysis(req.params.id);
    res.json(formatExplain(job, match, analysis));
  } catch (err) {
    next(err);
  }
});

app.get('/api/profile', async (_req, res, next) => {
  try {
    const profile = await loadProfile();
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

app.post('/api/profile/import', async (req, res, next) => {
  try {
    const yaml = req.body?.yaml as string;
    if (!yaml || typeof yaml !== 'string') {
      return res.status(400).json({ error: 'yaml field is required' });
    }
    const result = await importProfileFromYaml(yaml);
    res.json({ id: result.id, message: 'Profile imported successfully' });
  } catch (err) {
    next(err);
  }
});

app.post('/api/profile', async (req, res, next) => {
  try {
    const profile = req.body as CandidateProfile;
    if (!profile || !profile.skills || !profile.targetRoles) {
      return res.status(400).json({ error: 'Invalid profile format' });
    }
    const id = await upsertProfile(profile);
    res.json({ id, message: 'Profile imported successfully' });
  } catch (err) {
    next(err);
  }
});

app.post('/api/sync', async (_req, res, next) => {
  try {
    const results = await syncTrackedSources();
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`JobPilot M1 web server running at http://${HOST}:${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  server.close();
  await disconnectDb();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  server.close();
  await disconnectDb();
  process.exit(0);
});


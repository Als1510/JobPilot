import type { Express } from 'express';
import { listJobs, getJobById } from '@JobPilot/service';
import { analyzeJobs } from '@JobPilot/service';
import type { AnalyzeOutcome } from '@JobPilot/service';
import { computeMatches, recommendationFor } from '@JobPilot/service';
import { listRankedJobs } from '@JobPilot/service';
import { getAnalysis } from '@JobPilot/service';
import { getJobMatch } from '@JobPilot/service';
import { loadProfile } from '@JobPilot/service';
import { importProfileFromYaml } from '@JobPilot/service';
import { ingestManualJob } from '@JobPilot/service';
import { syncTrackedSources } from '@JobPilot/service';
import { getSource, listSourceNames } from '@JobPilot/sources';

function asyncHandler(fn: (req: any, res: any) => Promise<void>) {
  return (req: any, res: any) => {
    fn(req, res).catch((err) => {
      res.status(500).json({ error: (err as Error).message });
    });
  };
}

export function registerRoutes(app: Express): void {
  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'JobPilot M1' });
  });

  // Profile
  app.get('/api/profile', asyncHandler(async (_req, res) => {
    const profile = await loadProfile();
    if (!profile) {
      res.status(404).json({ error: 'No profile imported yet. POST /api/profile first.' });
      return;
    }
    res.json(profile);
  }));

  app.post('/api/profile', asyncHandler(async (req, res) => {
    const { yaml } = req.body as { yaml?: string };
    if (!yaml || typeof yaml !== 'string') {
      res.status(400).json({ error: 'Request body must include "yaml" string.' });
      return;
    }
    const result = await importProfileFromYaml(yaml);
    res.status(201).json(result);
  }));

  // Jobs
  app.get('/api/jobs', asyncHandler(async (_req, res) => {
    const jobs = await listJobs();
    res.json(jobs);
  }));

  app.get('/api/jobs/:id', asyncHandler(async (req, res) => {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: `No job with id "${req.params.id}".` });
      return;
    }
    res.json(job);
  }));

  app.post('/api/jobs/fetch', asyncHandler(async (req, res) => {
    const { source } = req.body as { source?: string };
    if (!source) {
      res.status(400).json({ error: 'Request body must include "source" string.' });
      return;
    }
    const jobSource = getSource(source);
    const raw = await jobSource.fetchJobs();
    const { saveJobs } = await import('@JobPilot/service');
    const result = await saveJobs(raw);
    res.status(201).json({ source, fetched: raw.length, ...result });
  }));

  app.post('/api/jobs/ingest', asyncHandler(async (req, res) => {
    const { content, title, company, location, url } = req.body as Record<string, string | undefined>;
    if (!content || !title || !company) {
      res.status(400).json({ error: 'Request body must include "content", "title", and "company".' });
      return;
    }
    const result = await ingestManualJob({ content, title, company, location, url });
    res.status(201).json(result);
  }));

  app.post('/api/jobs/sync', asyncHandler(async (_req, res) => {
    const result = await syncTrackedSources();
    res.json(result);
  }));

  // Analysis
  app.post('/api/analyze', asyncHandler(async (req, res) => {
    const { jobId, provider } = req.body as { jobId?: string; provider?: string };
    const outcomes: AnalyzeOutcome[] = await analyzeJobs({ jobId, provider });
    res.status(201).json({ analyzed: outcomes.length, outcomes });
  }));

  app.get('/api/jobs/:id/analysis', asyncHandler(async (req, res) => {
    const analysis = await getAnalysis(req.params.id);
    if (!analysis) {
      res.status(404).json({ error: `No analysis for job "${req.params.id}".` });
      return;
    }
    res.json(analysis);
  }));

  // Matching
  app.post('/api/match', asyncHandler(async (req, res) => {
    const { jobId } = req.body as { jobId?: string };
    const result = await computeMatches({ jobId });
    if (!result.profileFound) {
      res.status(404).json({ error: 'No profile imported. POST /api/profile first.' });
      return;
    }
    res.json(result);
  }));

  app.get('/api/jobs/:id/match', asyncHandler(async (req, res) => {
    const match = await getJobMatch(req.params.id);
    if (!match) {
      res.status(404).json({ error: `No match result for job "${req.params.id}".` });
      return;
    }
    res.json(match);
  }));

  // Ranking
  app.get('/api/rank', asyncHandler(async (_req, res) => {
    const ranked = await listRankedJobs();
    res.json(ranked);
  }));

  // Explain
  app.get('/api/jobs/:id/explain', asyncHandler(async (req, res) => {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: `No job with id "${req.params.id}".` });
      return;
    }
    const match = await getJobMatch(req.params.id);
    if (!match) {
      res.status(404).json({ error: `No match result for job "${req.params.id}". Run POST /api/match first.` });
      return;
    }
    const analysis = await getAnalysis(req.params.id);
    res.json({
      job,
      match,
      analysis,
      recommendation: recommendationFor(match),
    });
  }));

  // Sources
  app.get('/api/sources', (_req, res) => {
    res.json({ sources: listSourceNames() });
  });
}

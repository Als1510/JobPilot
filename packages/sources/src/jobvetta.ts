import type { RawJob, RemoteStatus } from '@JobPilot/core';
import { parseRemoteStatus } from '@JobPilot/core';
import type { JobSource } from './JobSource';

export const JOBVETTA_DEFAULT_BASE_URL = 'https://api.jobvetta.com/v1';

export interface JobvettaSourceOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Role, skill, or company keywords, e.g. "react developer". */
  q?: string;
  /** Indian city, town, or state, e.g. "Bengaluru" or "Karnataka". */
  location?: string;
  /** Only jobs first posted within the last N days. Accepted range 1-365. */
  days?: number;
  /** Number of jobs to return. Default 10. Range 1-10. */
  limit?: number;
}

/**
 * Documented shape of a single search-result record (`GET /v1/jobs`).
 * Optional fields may be null or omitted when an employer does not provide them.
 */
interface JobvettaJobSummary {
  job_id: string;
  title: string;
  company: string;
  location?: string | null;
  work_model?: string | null;
  employment_type?: string | null;
  salary?: unknown;
  url?: string | null;
}

interface JobvettaSearchResponse {
  total: number;
  jobs: JobvettaJobSummary[];
}

/**
 * Jobvetta Jobs API adapter - live India job data.
 *
 * Uses the global `fetch` (Node 20+). Configuration comes from
 * constructor options, falling back to env vars: JOBVETTA_API_KEY and
 * JOBVETTA_BASE_URL. Docs: https://jobvetta.com/api
 */
export class JobvettaSource implements JobSource {
  readonly name = 'jobvetta';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly q: string | undefined;
  private readonly location: string | undefined;
  private readonly days: number | undefined;
  private readonly limit: number | undefined;

  constructor(options: JobvettaSourceOptions = {}) {
    this.apiKey = (options.apiKey ?? process.env.JOBVETTA_API_KEY ?? '').trim();
    this.baseUrl = (options.baseUrl ?? process.env.JOBVETTA_BASE_URL ?? JOBVETTA_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.q = options.q?.trim() ? options.q : undefined;
    this.location = options.location?.trim() ? options.location : undefined;
    this.days = options.days;
    this.limit = options.limit;
  }

  async fetchJobs(): Promise<RawJob[]> {
    if (!this.apiKey) {
      throw new Error(
        'Jobvetta source requires JOBVETTA_API_KEY. Set it in .env, or use the built-in mock source.',
      );
    }

    const url = new URL(`${this.baseUrl}/jobs`);
    addParam(url, 'q', this.q);
    addParam(url, 'location', this.location);
    addParam(url, 'days', this.days);
    addParam(url, 'limit', this.limit);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) throw await jobvettaError(res);

    const data = (await res.json()) as Partial<JobvettaSearchResponse>;
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    return jobs.map((job) => toRawJob(this.name, job));
  }
}

/** Map a Jobvetta job summary into the canonical RawJob shape. */
function toRawJob(source: string, job: JobvettaJobSummary): RawJob {
  return {
    source,
    externalId: String(job.job_id ?? ''),
    company: String(job.company ?? ''),
    title: String(job.title ?? ''),
    location: job.location?.trim() ? job.location : null,
    remoteStatus: remoteFromWorkModel(job.work_model),
    url: job.url?.trim() ? job.url : null,
    description: buildDescription(job),
    postedAt: null, // not provided by the search response (the detail endpoint has it).
  };
}

/**
 * Explicit work_model to RemoteStatus mapping.
 *
 * Reuses the core `parseRemoteStatus` (handles "On-site"/"Remote"/"Hybrid")
 * case-insensitively. When a value cannot be determined reliably, return
 * null (never guess) - the normalizer defaults null to UNKNOWN.
 */
function remoteFromWorkModel(workModel: string | null | undefined): RemoteStatus | null {
  const trimmed = workModel?.trim();
  if (!trimmed) return null;
  const parsed = parseRemoteStatus(trimmed);
  return parsed === 'UNKNOWN' ? null : parsed;
}

/**
 * The `/jobs` search response does not carry the full JD (description lives
 * on `/jobs/{job_id}`). RawJob requires a description string, so compose a
 * truthful one-line summary from ONLY the fields Jobvetta returned - no new
 * information is invented, and an application link when provided.
 */
function buildDescription(job: JobvettaJobSummary): string {
  const parts = [
    job.title?.trim(),
    job.company?.trim(),
    job.location?.trim(),
    job.employment_type?.trim(),
  ].filter((p): p is string => Boolean(p));
  const base = parts.length ? parts.join(' — ') : 'Jobvetta job posting.';
  return job.url?.trim() ? `${base}\nApply: ${job.url}` : base;
}

function addParam(url: URL, key: string, value: string | number | undefined): void {
  if (value === undefined || value === null || value === '') return;
  url.searchParams.set(key, String(value));
}

/** Build an error from a non-2xx Jobvetta response, never including the API key. */
async function jobvettaError(res: Response): Promise<Error> {
  let message = `Jobvetta API responded ${res.status} (${res.statusText || 'No status text'})`;
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string' && body.error.trim()) {
      message = `Jobvetta API responded ${res.status}: ${body.error}`;
    }
  } catch {
    // Non-JSON error body - keep the default message.
  }
  return new Error(message);
}
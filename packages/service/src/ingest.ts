import type { RawJob } from '@JobPilot/core';
import { saveJobs } from './jobs';

/**
 * FNV-1a hash of the JD text, used as the manual job's externalId so the same
 * pasted description dedupes on re-ingest. Verbatim from the CLI.
 */
function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export interface IngestOptions {
  /** Raw job-description text. */
  content: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
}

/**
 * Manually ingest a job description as a `manual`-source RawJob. Normal
 * normalization (remote inference, fingerprint) and dedup happen inside
 * saveJobs exactly like every other source.
 */
export async function ingestManualJob(
  options: IngestOptions,
): Promise<{ created: number; duplicates: number }> {
  const raw: RawJob = {
    source: 'manual',
    externalId: `manual-${hashText(options.content.slice(0, 200))}`,
    company: options.company,
    title: options.title,
    location: options.location ?? null,
    remoteStatus: null,
    url: options.url ?? null,
    description: options.content,
    postedAt: new Date(),
  };
  return saveJobs([raw]);
}

import type { RawJob } from '@jobpilot/core';

/**
 * A job source adapter. Sources return RawJob records (before
 * normalization/dedup). New sources (Greenhouse, Lever, company pages)
 * implement this interface; the rest of the system never depends on a
 * specific source's API shape.
 */
export interface JobSource {
  /** Stable lowercase id, e.g. `mock`, `greenhouse`, `lever`. */
  readonly name: string;
  /**
   * Fetch jobs currently offered. Never guess fields - set null when a
   * source does not provide a value.
   */
  fetchJobs(): Promise<RawJob[]>;
}

export interface FetchResult {
  fetched: number;
  source: string;
}
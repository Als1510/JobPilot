import type { RemoteStatus } from './remote';

/**
 * A job as produced by a JobSource adapter, before normalization.
 * Adapters must never guess fields - leave unknown values null.
 */
export interface RawJob {
  /** Stable identifier of the source (e.g. `greenhouse`). */
  source: string;
  /** The source's own identifier for this job. */
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  remoteStatus: RemoteStatus | null;
  url: string | null;
  description: string;
  postedAt: Date | null;
}

/** A job after validation / normalization + dedup, ready to persist. */
export interface Job extends RawJob {
  /** Deterministic cross-source fingerprint. */
  fingerprint: string;
  remoteStatus: RemoteStatus;
  /** Free-form requirement string found verbatim in the post, if any. */
  requirements: string | null;
  /** Human-readable salary string, if the post disclosed one. */
  salary: string | null;
  /** e.g. Full-time / Contract / Internship, if the post disclosed one. */
  employmentType: string | null;
  discoveredAt: Date;
}
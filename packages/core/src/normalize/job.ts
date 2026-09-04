import type { Job, RawJob } from '../domain/job';
import type { RemoteStatus } from '../domain/remote';
import { parseRemoteStatus } from '../domain/remote';
import { fingerprintJob } from './fingerprint';

export interface NormalizeJobOptions {
  /** When the source did not state a remote status, fall back to parsing the location string. */
  inferRemoteFromLocation?: boolean;
}

/**
 * Normalize a RawJob into a Job: validate, default, fingerprint.
 *
 * Remote inference order (deterministic, explicit data always wins):
 *   1. the source-provided remoteStatus,
 *   2. the location string ("Remote (India)" -> REMOTE),
 *   3. the description text ("Location: Remote (India)" -> REMOTE).
 */
export function normalizeJob(raw: RawJob, options: NormalizeJobOptions = {}): Job {
  const location = raw.location?.trim() ? raw.location.trim() : null;

  let remoteStatus: RemoteStatus = raw.remoteStatus ?? 'UNKNOWN';
  if (options.inferRemoteFromLocation && remoteStatus === 'UNKNOWN') {
    if (location) {
      remoteStatus = parseRemoteStatus(location);
    }
    if (remoteStatus === 'UNKNOWN' && raw.description) {
      remoteStatus = parseRemoteStatus(raw.description);
    }
  }

  return {
    ...raw,
    company: raw.company.trim(),
    title: raw.title.trim(),
    location,
    remoteStatus,
    url: raw.url?.trim() ? raw.url : null,
    fingerprint: fingerprintJob(raw.company, raw.title, location),
    requirements: null,
    salary: null,
    employmentType: null,
    postedAt: raw.postedAt ?? null,
    discoveredAt: new Date(),
  };
}
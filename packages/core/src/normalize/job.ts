import type { Job, RawJob } from '../domain/job';
import type { RemoteStatus } from '../domain/remote';
import { parseRemoteStatus } from '../domain/remote';
import { fingerprintJob } from './fingerprint';

export interface NormalizeJobOptions {
  /** When the source did not state a remote status, fall back to parsing the location string. */
  inferRemoteFromLocation?: boolean;
}

/** Normalize a RawJob into a Job: validate, default, fingerprint. */
export function normalizeJob(raw: RawJob, options: NormalizeJobOptions = {}): Job {
  const location = raw.location?.trim() ? raw.location.trim() : null;

  let remoteStatus: RemoteStatus = raw.remoteStatus ?? 'UNKNOWN';
  if (remoteStatus === 'UNKNOWN' && options.inferRemoteFromLocation && location) {
    remoteStatus = parseRemoteStatus(location);
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
import { normalizeJob } from '@JobPilot/core';
import type { Job, RawJob } from '@JobPilot/core';
import { prisma } from '@JobPilot/db';

export interface SaveJobsResult {
  created: number;
  duplicates: number;
}

/** Normalize + upsert raw jobs. Dedup: (source, externalId) then fingerprint. */
export async function saveJobs(rawJobs: RawJob[]): Promise<SaveJobsResult> {
  let created = 0;
  let duplicates = 0;
  for (const raw of rawJobs) {
    const job = normalizeJob(raw, { inferRemoteFromLocation: true });
    if (await jobExists(job)) {
      duplicates += 1;
      continue;
    }
    await prisma.job.create({
      data: {
        source: job.source,
        externalId: job.externalId,
        fingerprint: job.fingerprint,
        company: job.company,
        title: job.title,
        location: job.location,
        remoteStatus: job.remoteStatus,
        url: job.url,
        description: job.description,
        postedAt: job.postedAt,
      },
    });
    created += 1;
  }
  return { created, duplicates };
}

async function jobExists(job: Job): Promise<boolean> {
  const byExternal = await prisma.job.findUnique({
    where: { source_externalId: { source: job.source, externalId: job.externalId } },
  });
  if (byExternal) return true;
  const byFingerprint = await prisma.job.findFirst({ where: { fingerprint: job.fingerprint } });
  return Boolean(byFingerprint);
}

export async function listJobs(): Promise<Array<Job & { id: string }>> {
  const rows = await prisma.job.findMany({ orderBy: { discoveredAt: 'desc' } });
  return rows.map((r) => ({ ...toJob(r), id: r.id }));
}

export async function getJobById(id: string): Promise<(Job & { id: string }) | null> {
  const r = await prisma.job.findUnique({ where: { id } });
  return r ? { ...toJob(r), id: r.id } : null;
}

/** Map a Prisma Job row to the domain Job shape (shared by ranked queries). */
export function toJob(r: {
  id: string;
  source: string;
  externalId: string;
  fingerprint: string;
  company: string;
  title: string;
  location: string | null;
  remoteStatus: string;
  url: string | null;
  description: string;
  requirements: string | null;
  salary: string | null;
  employmentType: string | null;
  postedAt: Date | null;
  discoveredAt: Date;
}): Job {
  return {
    source: r.source,
    externalId: r.externalId,
    fingerprint: r.fingerprint,
    company: r.company,
    title: r.title,
    location: r.location,
    remoteStatus: r.remoteStatus as Job['remoteStatus'],
    url: r.url,
    description: r.description,
    requirements: r.requirements,
    salary: r.salary,
    employmentType: r.employmentType,
    postedAt: r.postedAt,
    discoveredAt: r.discoveredAt,
  };
}

import { canonicalizeSkill, normalizeJob } from '@jobpilot/core';
import { prisma } from '@jobpilot/db';
import type {
  CandidateProfile,
  ExtractedJobInfo,
  Job,
  MatchResult,
  RawJob,
} from '@jobpilot/core';

/** Upsert a skill row by canonical name, returning its id. */
async function ensureSkill(canonical: string): Promise<string> {
  const { canonical: clean } = canonicalizeSkill(canonical);
  const row = await prisma.skill.upsert({
    where: { canonical: clean },
    create: { canonical: clean, category: 'other', aliases: '[]' },
    update: {},
  });
  return row.id;
}

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

function toJob(r: {
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

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Persist the given master profile (skills + roles + work history for M1). */
export async function upsertProfile(profile: CandidateProfile): Promise<string> {
  for (const s of profile.skills) {
    await ensureSkill(s.skillName);
  }

  const existing = await prisma.candidateProfile.findFirst();
  const core = {
    name: profile.name,
    headline: profile.headline,
    summary: profile.summary,
    totalYearsExperience: profile.totalYearsExperience,
    remotePreference: profile.remotePreference,
  };

  if (existing) {
    await prisma.candidateProfile.update({ where: { id: existing.id }, data: core });
    await prisma.candidateTargetRole.deleteMany({ where: { profileId: existing.id } });
    await prisma.candidateTargetLocation.deleteMany({ where: { profileId: existing.id } });
    await prisma.candidateSkill.deleteMany({ where: { profileId: existing.id } });
    await prisma.workExperience.deleteMany({ where: { profileId: existing.id } });
    await linkProfileParts(existing.id, profile);
    return existing.id;
  }
  const created = await prisma.candidateProfile.create({ data: core });
  await linkProfileParts(created.id, profile);
  return created.id;
}

async function linkProfileParts(profileId: string, profile: CandidateProfile): Promise<void> {
  for (const role of profile.targetRoles) {
    await prisma.candidateTargetRole.create({ data: { profileId, role } });
  }
  for (const location of profile.targetLocations) {
    await prisma.candidateTargetLocation.create({ data: { profileId, location } });
  }
  for (const skill of profile.skills) {
    const skillId = await ensureSkill(skill.skillName);
    await prisma.candidateSkill.create({ data: { profileId, skillId, level: skill.level } });
  }
  for (const we of profile.workExperience) {
    await prisma.workExperience.create({
      data: {
        profileId,
        role: we.role,
        company: we.company,
        startDate: we.startDate,
        endDate: we.endDate,
        isCurrent: we.isCurrent,
        description: we.description,
      },
    });
  }
}

export async function loadProfile(): Promise<CandidateProfile | null> {
  const p = await prisma.candidateProfile.findFirst({
    include: {
      targetRoles: true,
      targetLocations: true,
      skills: { include: { skill: true } },
      workExperience: true,
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    headline: p.headline,
    summary: p.summary,
    totalYearsExperience: p.totalYearsExperience,
    remotePreference: p.remotePreference as CandidateProfile['remotePreference'],
    targetRoles: p.targetRoles.map((r) => r.role),
    targetLocations: p.targetLocations.map((l) => l.location),
    skills: p.skills.map((s) => ({ skillName: s.skill.canonical, level: s.level })),
    workExperience: p.workExperience,
    education: [],
    projects: [],
    achievements: [],
  };
}

// ---------------------------------------------------------------------------
// Analysis + matches
// ---------------------------------------------------------------------------

export async function saveAnalysis(jobId: string, extracted: ExtractedJobInfo, model: string): Promise<void> {
  await prisma.jobAnalysis.upsert({
    where: { jobId },
    create: { jobId, model, status: 'COMPLETED', extracted: JSON.stringify(extracted) },
    update: { model, status: 'COMPLETED', extracted: JSON.stringify(extracted) },
  });
}

export async function getAnalysis(jobId: string): Promise<ExtractedJobInfo | null> {
  const a = await prisma.jobAnalysis.findUnique({ where: { jobId } });
  return a ? (JSON.parse(a.extracted) as ExtractedJobInfo) : null;
}

export async function getJobsWithoutAnalysis(): Promise<Array<{ id: string } & Job>> {
  const rows = await prisma.job.findMany({
    where: { analysis: null },
    orderBy: { discoveredAt: 'asc' },
  });
  return rows.map((r) => ({ ...toJob(r), id: r.id }));
}

export async function saveMatch(jobId: string, match: MatchResult): Promise<void> {
  await prisma.matchResult.upsert({
    where: { jobId },
    create: {
      jobId,
      totalScore: match.totalScore,
      isStrongMatch: match.isStrongMatch,
      categoryScores: JSON.stringify(match.categoryScores),
      matchedSkills: JSON.stringify(match.matchedSkills),
      profileVersion: match.profileVersion,
    },
    update: {
      totalScore: match.totalScore,
      isStrongMatch: match.isStrongMatch,
      categoryScores: JSON.stringify(match.categoryScores),
      matchedSkills: JSON.stringify(match.matchedSkills),
      profileVersion: match.profileVersion,
    },
  });

  await prisma.jobSkill.deleteMany({ where: { jobId } });
  for (const ms of match.matchedSkills) {
    const { canonical } = canonicalizeSkill(ms.skill);
    const skill = await prisma.skill.findUnique({ where: { canonical } });
    if (!skill) continue;
    await prisma.jobSkill.create({
      data: { jobId, skillId: skill.id, kind: ms.kind, matched: ms.matched },
    });
  }
}

export async function getJobMatch(jobId: string): Promise<MatchResult | null> {
  const m = await prisma.matchResult.findUnique({ where: { jobId } });
  if (!m) return null;
  return {
    jobId,
    profileVersion: m.profileVersion,
    totalScore: m.totalScore,
    categoryScores: JSON.parse(m.categoryScores) as MatchResult['categoryScores'],
    matchedSkills: JSON.parse(m.matchedSkills) as MatchResult['matchedSkills'],
    isStrongMatch: m.isStrongMatch,
    createdAt: m.createdAt,
  };
}

export interface RankedJob {
  job: Job & { id: string };
  totalScore: number | null;
  isStrongMatch: boolean | null;
  hasAnalysis: boolean;
}

export async function listRankedJobs(): Promise<RankedJob[]> {
  const rows = await prisma.job.findMany({
    include: { matchResult: true, analysis: { select: { status: true } } },
  });
  return rows
    .map((r) => ({
      job: { ...toJob(r), id: r.id },
      totalScore: r.matchResult?.totalScore ?? null,
      isStrongMatch: r.matchResult?.isStrongMatch ?? null,
      hasAnalysis: Boolean(r.analysis),
    }))
    .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
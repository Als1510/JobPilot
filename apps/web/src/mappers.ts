import type { Job, MatchResult } from '@JobPilot/core';

export interface JobDTO {
  source: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  remoteStatus: string;
  url: string | null;
  description: string;
  postedAt: string | null;
  fingerprint: string;
  discoveredAt: string;
}

export interface MatchDTO {
  jobId: string;
  profileVersion: string;
  totalScore: number;
  categoryScores: MatchResult['categoryScores'];
  matchedSkills: MatchResult['matchedSkills'];
  isStrongMatch: boolean;
  createdAt: string;
}

export function toJobDTO(job: Job): JobDTO {
  return {
    source: job.source,
    externalId: job.externalId,
    company: job.company,
    title: job.title,
    location: job.location,
    remoteStatus: job.remoteStatus,
    url: job.url,
    description: job.description,
    postedAt: job.postedAt ? job.postedAt.toISOString() : null,
    fingerprint: job.fingerprint,
    discoveredAt: job.discoveredAt.toISOString(),
  };
}

export function toMatchDTO(match: MatchResult): MatchDTO {
  return {
    jobId: match.jobId,
    profileVersion: match.profileVersion,
    totalScore: match.totalScore,
    categoryScores: match.categoryScores,
    matchedSkills: match.matchedSkills,
    isStrongMatch: match.isStrongMatch,
    createdAt: match.createdAt.toISOString(),
  };
}

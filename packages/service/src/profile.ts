import type { CandidateProfile } from '@JobPilot/core';
import { prisma } from '@JobPilot/db';
import { ensureSkill } from './skills';

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

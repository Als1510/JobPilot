import { z } from 'zod';
import type { CandidateProfile } from '@jobpilot/core';

export const remoteZ = z.enum(['REMOTE', 'HYBRID', 'ONSITE']);

export const profileYamlSchema = z.object({
  name: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string(),
  totalYearsExperience: z.number().nonnegative(),
  remotePreference: remoteZ,
  targetRoles: z.array(z.string().min(1)).default([]),
  targetLocations: z.array(z.string().min(1)).default([]),
  skills: z
    .array(
      z.object({
        skillName: z.string().min(1),
        level: z.string().nullable().optional(),
      }),
    )
    .default([]),
  workExperience: z
    .array(
      z.object({
        role: z.string().min(1),
        company: z.string().min(1),
        startDate: z.string(),
        endDate: z.string().nullable().optional(),
        isCurrent: z.boolean().default(false),
        description: z.string(),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().min(1),
        institution: z.string().min(1),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
      }),
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        techStack: z.array(z.string()).default([]),
        url: z.string().nullable().optional(),
      }),
    )
    .default([]),
  achievements: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string(),
      }),
    )
    .default([]),
});

export type ProfileYaml = z.infer<typeof profileYamlSchema>;

/** The YAML profile -> domain CandidateProfile (id null until persisted). */
export function yamlToProfile(y: ProfileYaml): CandidateProfile {
  return {
    id: null,
    name: y.name.trim(),
    headline: y.headline.trim(),
    summary: y.summary.trim(),
    totalYearsExperience: y.totalYearsExperience,
    remotePreference: y.remotePreference,
    targetRoles: y.targetRoles.map((r) => r.trim()),
    targetLocations: y.targetLocations.map((l) => l.trim()),
    skills: y.skills.map((s) => ({ skillName: s.skillName.trim(), level: s.level ?? null })),
    workExperience: y.workExperience.map((we) => ({
      role: we.role.trim(),
      company: we.company.trim(),
      startDate: we.startDate,
      endDate: we.endDate ?? null,
      isCurrent: we.isCurrent,
      description: we.description,
    })),
    education: y.education.map((e) => ({
      degree: e.degree.trim(),
      institution: e.institution.trim(),
      startDate: e.startDate ?? null,
      endDate: e.endDate ?? null,
    })),
    projects: y.projects.map((p) => ({
      name: p.name.trim(),
      description: p.description,
      techStack: p.techStack.map((t) => t.trim()),
      url: p.url ?? null,
    })),
    achievements: y.achievements.map((a) => ({ title: a.title.trim(), description: a.description })),
  };
}
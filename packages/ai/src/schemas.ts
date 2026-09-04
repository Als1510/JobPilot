import { z } from 'zod';
import { REMOTE_STATUSES } from '@JobPilot/core';

/**
 * Zod schema for the structured information we extract from a job
 * description. The LLM output is validated against this - and retried
 * once on failure - so a stray JSON field can never silently corrupt
 * the data model. This is the single source of truth for extraction.
 */
export const remoteStatusSchema = z.enum(REMOTE_STATUSES);

export const extractedJobInfoSchema = z.object({
  /** Skills the job requires (as written in the JD; normalized later). */
  requiredSkills: z.array(z.string().min(1)).default([]),
  /** Skills listed as preferred / nice-to-have. */
  preferredSkills: z.array(z.string().min(1)).default([]),
  /** Total experience requested, in years. null when not stated. */
  experienceYears: z.number().int().nonnegative().nullable().default(null),
  location: z.string().nullable().default(null),
  remoteStatus: remoteStatusSchema,
  salary: z.string().nullable().default(null),
  seniority: z.string().nullable().default(null),
  responsibilities: z.array(z.string()).default([]),
  applicationQuestions: z.array(z.string()).default([]),
});

export type ExtractedJobInfoZod = z.infer<typeof extractedJobInfoSchema>;

export { extractedJobInfoSchema as zodExtractedJobInfoSchema };
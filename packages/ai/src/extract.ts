import type { ExtractedJobInfo } from '@jobpilot/core';
import type { ExtractJobContext, LanguageModel } from './provider';
import { extractedJobInfoSchema } from './schemas';

export interface ExtractOptions {
  context?: ExtractJobContext;
  /** How many times to retry after a schema-validation failure. Default 1. */
  maxRetries?: number;
}

/**
 * Run the LLM and validate its structured output against the Zod schema.
 * Deterministic, validated, retried - core of the "LLM only for reasoning"
 * boundary. Returns a validated ExtractedJobInfo.
 */
export async function extractJobInfo(
  model: LanguageModel,
  jobDescription: string,
  options: ExtractOptions = {},
): Promise<ExtractedJobInfo> {
  const maxRetries = options.maxRetries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await model.extractJobInfo(jobDescription, options.context);
      return extractedJobInfoSchema.parse(raw);
    } catch (err) {
      const isValidationError = err instanceof Error && err.name === 'ZodError';
      if (isValidationError && attempt < maxRetries) {
        lastError = err;
        continue; // retry once on a malformed response
      }
      throw new Error(
        `Job extraction failed after ${attempt + 1} attempt(s): ${(err as Error).message}`,
      );
    }
  }
  // Unreachable, but keeps TS satisfied about the return.
  throw lastError ?? new Error('extraction failed');
}
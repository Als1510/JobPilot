import { zodToJsonSchema } from 'zod-to-json-schema';
import { extractedJobInfoSchema } from './schemas';

/**
 * LanguageModel abstraction.
 *
 * JobPilot deliberately never hardcodes a single LLM provider. Everything
 * that needs reasoning flows through this interface, so the app is free to
 * switch between OpenRouter, any OpenAI-compatible endpoint (DeepSeek,
 * NVIDIA, vLLM...) or an offline Fake provider without core code changes.
 */
export interface LanguageModel {
  readonly name: string;

  /**
   * Ask the model to produce structured information about a job
   * description. Implementations SHOULD use structured outputs when the
   * endpoint supports them, but MUST always return something that passes
   * `extractedJobInfoSchema` - validation happens in the caller.
   */
  extractJobInfo(jobDescription: string, context?: ExtractJobContext): Promise<unknown>;
}

export interface ExtractJobContext {
  title?: string | null;
  location?: string | null;
  company?: string | null;
}

/**
 * JSON Schema (OpenAI target) for `response_format.type = "json_schema"`.
 * Precomputed once - real (non-fake) providers send this and let the
 * endpoint enforce the shape.
 */
export const extractedJobInfoJsonSchema = zodToJsonSchema(extractedJobInfoSchema, {
  target: 'openAi',
});
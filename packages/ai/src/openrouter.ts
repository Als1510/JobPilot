import type { ExtractJobContext, LanguageModel } from './provider';
import { extractedJobInfoJsonSchema } from './provider';

export interface OpenRouterConfig {
  apiKey?: string;
  /** e.g. https://openrouter.ai/api/v1 */
  baseUrl?: string;
  /** e.g. openai/gpt-4o-mini */
  model?: string;
  extraHeaders?: Record<string, string>;
}

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

/**
 * Chat-completions provider speaking the OpenAI wire format - which is what
 * OpenRouter (and most OpenAI-compatible providers like DeepSeek, NVIDIA,
 * vLLM, LM Studio) speaks. Configure via env; switch providers by pointing
 * LLM_API_BASE/KEY/MODEL at a different base URL - no code change.
 */
export class OpenRouterProvider implements LanguageModel {
  readonly name: string;
  private readonly cfg: Required<Omit<OpenRouterConfig, 'extraHeaders'>> & { extraHeaders?: Record<string, string> };

  constructor(config: OpenRouterConfig = {}) {
    const baseUrl = (config.baseUrl ?? process.env.LLM_API_BASE ?? DEFAULT_BASE).replace(/\/$/, '');
    const model = config.model ?? process.env.LLM_MODEL ?? DEFAULT_MODEL;
    this.name = `openrouter:${model}`;
    this.cfg = {
      apiKey: config.apiKey ?? process.env.LLM_API_KEY ?? '',
      baseUrl,
      model,
      extraHeaders: config.extraHeaders ?? parseExtraHeaders(process.env.LLM_EXTRA_HEADERS),
    };
  }

  async extractJobInfo(jobDescription: string, context?: ExtractJobContext): Promise<unknown> {
    if (!this.cfg.apiKey) {
      throw new Error(
        'LLM_API_KEY is not set. Configure your key in .env (or switch LLM_PROVIDER=Fake for offline runs).',
      );
    }

    const system = [
      'You are the extraction step of an AI job-search assistant.',
      'Read the job description and extract structured, factual information.',
      'Only include values that appear in the text. Never invent requirements.',
      'Return JSON that exactly matches the provided schema.',
    ].join('\n');

    const user = [
      context?.company ? `Job Description for ${context.company}` : 'Job Description',
      context?.title ? `Position: ${context.title}` : '',
      context?.location ? `Location: ${context.location}` : '',
      '---',
      jobDescription,
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
        ...this.cfg.extraHeaders,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: extractedJobInfoJsonSchema,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM returned no content in choices[0].message.content.');
    return JSON.parse(content);
  }
}

function parseExtraHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return undefined;
  }
}
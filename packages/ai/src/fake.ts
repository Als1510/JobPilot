import { canonicalizeSkill, parseRemoteStatus } from '@JobPilot/core';
import type { ExtractJobContext, LanguageModel } from './provider';

/**
 * FakeProvider - deterministic, offline, no API key required.
 *
 * It is NOT an LLM. It heuristically extracts a best-effort structured view
 * from a JD so the entire M1 pipeline (fetch -> analyze -> match -> rank)
 * runs end-to-end with zero network/cost. It is also the default provider in
 * .env.example so a fresh clone works immediately. Swap to a real provider
 * for higher-quality extraction.
 */
export class FakeProvider implements LanguageModel {
  readonly name = 'fake';

  constructor(private readonly seed = 1) {}

  async extractJobInfo(jobDescription: string, context?: ExtractJobContext): Promise<unknown> {
    const text = `${context?.title ?? ''} ${jobDescription}`;

    const required: string[] = [];
    const preferred: string[] = [];

    // Scan sentences for known skills, classifying by signal words.
    // Split on newlines, semicolons and ". " (period + whitespace) only:
    // a bare "." splitter would shred dotted skill names like "Next.js"
    // into "Next" + "js" (the latter canonicalizing to "JavaScript").
    const sentences = jobDescription
      .split(/\n+|;\s*|\.\s+/)
      .map((s) => s.trim().replace(/\.+$/, ''))
      .filter(Boolean);

    const seen = new Set<string>();
    const addSkill = (word: string, kind: 'REQUIRED' | 'PREFERRED') => {
      const { canonical, recognized } = canonicalizeSkill(word);
      // Only treat tokens that are known canonical skills as skills. The
      // fake provider is heuristic - unrecognized words are NOT invented.
      if (!recognized || !canonical) return;
      const key = `${kind}:${canonical}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (kind === 'REQUIRED') required.push(canonical);
      else preferred.push(canonical);
    };

    // Signal words classify their own line AND carry over to the bare list
    // items that follow (section-style JDs: "Required skills:" / "- React").
    // Deterministic: the last explicit signal wins; text with no signal
    // inherits the running one (defaulting to REQUIRED).
    let carry: 'REQUIRED' | 'PREFERRED' = 'REQUIRED';
    for (const sentence of sentences) {
      const low = sentence.toLowerCase();
      const obligated = /require|must|expect|we re looking|needed|essential|should have/.test(low);
      const optional = /plus|nice to have|nice-to-have|preferred|bonus|a plus|desirable/.test(low);
      if (obligated) carry = 'REQUIRED';
      else if (optional) carry = 'PREFERRED';

      for (const word of wordTokens(sentence)) {
        addSkill(word, carry);
      }
    }
    if (context?.title) {
      for (const word of wordTokens(context.title)) addSkill(word, 'REQUIRED');
    }

    const experience = extractYears(text);
    const remoteStatus = parseRemoteStatus(context?.location ?? extractLocation(text));
    const seniority = extractSeniority(text);

    return {
      requiredSkills: dedupe(required),
      preferredSkills: dedupe(preferred),
      experienceYears: experience,
      location: extractLocation(text) ?? context?.location ?? null,
      remoteStatus,
      salary: extractSalary(text),
      seniority,
      responsibilities: [],
      applicationQuestions: extractQuestions(jobDescription),
    };
  }
}

function wordTokens(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9+.#/]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && w.length < 30);
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function extractYears(text: string): number | null {
  const m = text.match(/(\d{1,2})\+?\s*(?:-|\s)?\s*years?/i);
  return m ? parseInt(m[1]!, 10) : null;
}

function extractLocation(text: string): string | null {
  const m = text.match(/([A-Za-z][A-Za-z ,-]+india)/i);
  return m ? m[1]!.trim() : null;
}

function extractSeniority(text: string): string | null {
  const m = text.match(/\b(senior|staff|principal|lead|mid|junior)\b/i);
  return m ? m[1]! : null;
}

function extractSalary(text: string): string | null {
  const m = text.match(/(\$[\d,]+(?:\s*-\s*\$[\d,]+|\s*\+\s*)?(?:\s*k)?)/i);
  return m ? m[1]!.trim() : null;
}

function extractQuestions(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('?'));
}
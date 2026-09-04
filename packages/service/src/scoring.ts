import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ScoringWeights } from '@JobPilot/core';

// ---------------------------------------------------------------------------
// Scoring configuration loading (moved verbatim from apps/cli/src/index.ts)
// ---------------------------------------------------------------------------

const here = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(here), '..', '..', '..');

/** Load scoring weight overrides from config/scoring.json (empty on failure). */
export function loadScoring(): Partial<ScoringWeights> {
  try {
    const raw = readFileSync(resolve(repoRoot, 'config', 'scoring.json'), 'utf8');
    const parsed = JSON.parse(raw) as { weights?: Partial<ScoringWeights> };
    return parsed.weights ?? {};
  } catch {
    return {};
  }
}

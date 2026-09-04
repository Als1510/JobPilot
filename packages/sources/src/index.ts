import type { JobSource } from './JobSource';
import { MockSource } from './mock';
import { GreenhouseSource } from './greenhouse';

import { JobvettaSource } from './jobvetta';

export * from './JobSource';
export * from './mock';
export * from './jobvetta';

/**
 * Named source registry. Add new real sources here as they are implemented.
 * M1 ships with the Mock source (offline) so the pipeline runs without keys.
 */
export function getSource(name: string, env: NodeJS.ProcessEnv = process.env): JobSource {
  switch (name.toLowerCase()) {
    case 'mock':
    case 'mock-greenhouse':
      return new MockSource('mock-greenhouse');
    case 'mock-lever':
      return new MockSource('mock-lever');
    case 'greenhouse':
      return new GreenhouseSource(env.GREENHOUSE_BOARD_TOKEN);
    case 'jobvetta':
      return new JobvettaSource({
        apiKey: env.JOBVETTA_API_KEY,
        baseUrl: env.JOBVETTA_BASE_URL,
      });
    default:
      throw new Error(
        `Unknown job source "${name}". Available: mock, mock-greenhouse, mock-lever, greenhouse, jobvetta.`,
      );
  }
}

export function listSourceNames(): string[] {
  return ['mock', 'greenhouse', 'jobvetta'];
}
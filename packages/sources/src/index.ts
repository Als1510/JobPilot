import type { JobSource } from './JobSource';
import { MockSource } from './mock';
import { GreenhouseSource } from './greenhouse';

export * from './JobSource';
export * from './mock';

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
    default:
      throw new Error(
        `Unknown job source "${name}". Available: mock, mock-greenhouse, mock-lever, greenhouse.`,
      );
  }
}

export function listSourceNames(): string[] {
  return ['mock', 'greenhouse'];
}
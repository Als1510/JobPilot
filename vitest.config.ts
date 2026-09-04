import { defineConfig } from 'vitest/config';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Use a temp SQLite DB for tests so the dev DB is never mutated.
const testDbPath = join(tmpdir(), `jobpilot-test-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${testDbPath}`;

// Resolve the schema path relative to this config file so it works on all platforms.
const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, 'packages', 'db', 'prisma', 'schema.prisma');

// Ensure the schema is synced before any tests run.
try {
  execSync(`npx prisma db push --schema "${schemaPath}" --skip-generate`, {
    stdio: 'pipe',
    cwd: here,
  });
} catch (e) {
  console.error('Failed to sync test database schema:', (e as Error).message);
  process.exit(1);
}

export default defineConfig({
  test: {
    // CLI tests (trackedSources.test.ts + sync.test.ts) share a Prisma client
    // against the same temp DB. They must run in a single fork so their
    // beforeEach cleanup hooks don't race.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
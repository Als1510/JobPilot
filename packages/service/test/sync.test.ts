import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@JobPilot/db';
import {
  createTrackedSource,
  listTrackedSources,
  setTrackedSourceEnabled,
  syncTrackedSources,
  disconnectDb,
} from '@JobPilot/service';

// Integration tests for the sync workflow. They run against the temp SQLite
// DB provisioned by vitest.config.ts (schema pushed once up front); each test
// starts from empty Job + TrackedSource tables.

beforeEach(async () => {
  await prisma.job.deleteMany();
  await prisma.trackedSource.deleteMany();
});

afterAll(async () => {
  await disconnectDb();
});

/** Register a tracked source and return its row id. */
async function track(sourceType: string, identifier: string): Promise<string> {
  return createTrackedSource({ sourceType, identifier });
}

describe('syncTrackedSources', () => {
  it('syncs only enabled sources and stamps lastFetchedAt on success only', async () => {
    const gh = await track('mock-greenhouse', 'board-a');
    const lv = await track('mock-lever', 'board-b');
    await setTrackedSourceEnabled(lv, false);

    const result = await syncTrackedSources();

    expect(result.enabledCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      trackedSourceId: gh,
      sourceType: 'mock-greenhouse',
      identifier: 'board-a',
      ok: true,
      fetched: 3,
      created: 3,
      duplicates: 0,
    });

    const rows = await listTrackedSources();
    expect(rows.find((r) => r.id === gh)?.lastFetchedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === lv)?.lastFetchedAt).toBeNull();

    expect(await prisma.job.count()).toBe(3);
  });

  it('isolates a failing source without blocking the others', async () => {
    const lv = await track('mock-lever', 'board-b');
    const bogus = await track('no-such-source', 'oops');

    const result = await syncTrackedSources();

    expect(result.enabledCount).toBe(2);
    expect(result.results).toHaveLength(2);

    const lvResult = result.results.find((r) => r.trackedSourceId === lv);
    expect(lvResult?.ok).toBe(true);
    expect(lvResult?.created).toBe(2); // lv-9999 + lv-8123

    const bogusResult = result.results.find((r) => r.trackedSourceId === bogus);
    expect(bogusResult?.ok).toBe(false);
    expect(bogusResult?.error).toMatch(/Unknown job source/);

    const rows = await listTrackedSources();
    expect(rows.find((r) => r.id === lv)?.lastFetchedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === bogus)?.lastFetchedAt).toBeNull();

    expect(await prisma.job.count()).toBe(2);
  });

  it('dedupes on re-sync instead of duplicating jobs', async () => {
    await track('mock-greenhouse', 'board-a');

    const first = await syncTrackedSources();
    expect(first.results[0]?.created).toBe(3);

    const second = await syncTrackedSources();
    expect(second.results[0]?.created).toBe(0);
    expect(second.results[0]?.duplicates).toBe(3);

    expect(await prisma.job.count()).toBe(3);
  });

  it('reports cross-board fingerprint duplicates and fires onSourceStart per source', async () => {
    await track('mock-greenhouse', 'board-a');
    await track('mock-lever', 'board-b');

    const started: string[] = [];
    const result = await syncTrackedSources({
      onSourceStart: (info) => started.push(info.sourceName),
    });

    expect(result.results).toHaveLength(2);
    expect(started).toHaveLength(2);
    expect(new Set(started)).toEqual(new Set(['mock-greenhouse', 'mock-lever']));

    // mock-lever's lv-9999 is the same role as mock-greenhouse's gh-1001
    // (fingerprint collapse), so only lv-8123 is new on the second board.
    const created = result.results.reduce((sum, r) => sum + (r.created ?? 0), 0);
    const duplicates = result.results.reduce((sum, r) => sum + (r.duplicates ?? 0), 0);
    expect(created).toBe(4);
    expect(duplicates).toBe(1);
    expect(await prisma.job.count()).toBe(4);
  });
});
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@JobPilot/db';
import {
  createTrackedSource,
  listTrackedSources,
  setTrackedSourceEnabled,
  recordFetchSuccess,
  disconnectDb,
} from '@JobPilot/service';

// Integration tests for tracked-source CRUD. They run against the temp
// SQLite DB provisioned by vitest.config.ts (schema pushed once up front),
// with each test starting from an empty TrackedSource table.

beforeEach(async () => {
  await prisma.trackedSource.deleteMany();
});

afterAll(async () => {
  await disconnectDb();
});

describe('trackedSources', () => {
  it('upserts on (sourceType, identifier) and updates name/url', async () => {
    const first = await createTrackedSource({
      sourceType: 'mock-greenhouse',
      identifier: 'board-a',
      name: 'Acme board',
    });
    const second = await createTrackedSource({
      sourceType: 'mock-greenhouse',
      identifier: 'board-a',
      name: 'Acme board (renamed)',
      url: 'https://example.test/careers',
    });

    expect(second).toBe(first);
    const rows = await listTrackedSources();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Acme board (renamed)');
    expect(rows[0]!.url).toBe('https://example.test/careers');
  });

  it('lists sources with the documented defaults', async () => {
    await createTrackedSource({ sourceType: 'mock-lever', identifier: 'board-b' });

    const rows = await listTrackedSources();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceType: 'mock-lever',
      identifier: 'board-b',
      enabled: true,
    });
    expect(rows[0]!.lastFetchedAt).toBeNull();
  });

  it('enables and disables a source by id', async () => {
    const id = await createTrackedSource({ sourceType: 'mock-greenhouse', identifier: 'x' });

    await setTrackedSourceEnabled(id, false);
    expect((await listTrackedSources()).find((r) => r.id === id)?.enabled).toBe(false);

    await setTrackedSourceEnabled(id, true);
    expect((await listTrackedSources()).find((r) => r.id === id)?.enabled).toBe(true);
  });

  it('stamps lastFetchedAt only on the targeted source', async () => {
    const a = await createTrackedSource({ sourceType: 'mock-greenhouse', identifier: 'a' });
    const b = await createTrackedSource({ sourceType: 'mock-lever', identifier: 'b' });

    await recordFetchSuccess(a);

    const rows = await listTrackedSources();
    expect(rows.find((r) => r.id === a)?.lastFetchedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === b)?.lastFetchedAt).toBeNull();
  });
});
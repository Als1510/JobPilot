import { prisma } from '@JobPilot/db';

// ---------------------------------------------------------------------------
// Tracked sources (moved verbatim from apps/cli/src/db.ts)
// ---------------------------------------------------------------------------

export interface CreateTrackedSourceOptions {
  sourceType: string;
  identifier: string;
  name?: string;
  url?: string;
}

/** Create or update a tracked source. Unique on (sourceType, identifier). */
export async function createTrackedSource(options: CreateTrackedSourceOptions): Promise<string> {
  const row = await prisma.trackedSource.upsert({
    where: {
      sourceType_identifier: {
        sourceType: options.sourceType,
        identifier: options.identifier,
      },
    },
    create: {
      sourceType: options.sourceType,
      identifier: options.identifier,
      name: options.name ?? null,
      url: options.url ?? null,
    },
    update: {
      name: options.name ?? null,
      url: options.url ?? null,
    },
  });
  return row.id;
}

export interface TrackedSourceRow {
  id: string;
  sourceType: string;
  identifier: string;
  name: string | null;
  url: string | null;
  enabled: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** List all tracked sources. */
export async function listTrackedSources(): Promise<TrackedSourceRow[]> {
  const rows = await prisma.trackedSource.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    identifier: r.identifier,
    name: r.name,
    url: r.url,
    enabled: r.enabled,
    lastFetchedAt: r.lastFetchedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/** Enable or disable a tracked source by id. */
export async function setTrackedSourceEnabled(id: string, enabled: boolean): Promise<void> {
  await prisma.trackedSource.update({
    where: { id },
    data: { enabled },
  });
}

/** Update lastFetchedAt to now for a given tracked source. */
export async function recordFetchSuccess(id: string): Promise<void> {
  await prisma.trackedSource.update({
    where: { id },
    data: { lastFetchedAt: new Date() },
  });
}

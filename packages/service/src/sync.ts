import { getSource } from '@JobPilot/sources';
import { saveJobs } from './jobs';
import { listTrackedSources, recordFetchSuccess } from './trackedSources';

export interface SyncSourceOutcome {
  trackedSourceId: string;
  sourceType: string;
  identifier: string;
  ok: boolean;
  fetched?: number;
  created?: number;
  duplicates?: number;
  error?: string;
}

export interface SyncResult {
  enabledCount: number;
  results: SyncSourceOutcome[];
}

export interface SyncSourceStartInfo {
  trackedSourceId: string;
  sourceType: string;
  identifier: string;
  /** Registry name of the resolved JobSource (e.g. "mock-greenhouse"). */
  sourceName: string;
}

export interface SyncOptions {
  /**
   * Optional progress hook invoked right before each source fetch. The CLI
   * uses it to print live "Fetching from ..." lines in the original order;
   * server callers simply omit it.
   */
  onSourceStart?: (info: SyncSourceStartInfo) => void;
}

/**
 * Fetch jobs from every enabled tracked source, normalize + dedupe + persist,
 * and stamp `lastFetchedAt` on success only. A failing source never blocks the
 * others and never gets a timestamp update.
 *
 * Extracted verbatim from the CLI `jobs sync` command body; the CLI now only
 * formats the returned outcomes.
 */
export async function syncTrackedSources(options: SyncOptions = {}): Promise<SyncResult> {
  const sources = await listTrackedSources();
  const enabled = sources.filter((s) => s.enabled);
  const results: SyncSourceOutcome[] = [];

  for (const ts of enabled) {
    try {
      const source = getSource(ts.sourceType);
      options.onSourceStart?.({
        trackedSourceId: ts.id,
        sourceType: ts.sourceType,
        identifier: ts.identifier,
        sourceName: source.name,
      });
      const raw = await source.fetchJobs();
      const { created, duplicates } = await saveJobs(raw);
      await recordFetchSuccess(ts.id);
      results.push({
        trackedSourceId: ts.id,
        sourceType: ts.sourceType,
        identifier: ts.identifier,
        ok: true,
        fetched: raw.length,
        created,
        duplicates,
      });
    } catch (err) {
      results.push({
        trackedSourceId: ts.id,
        sourceType: ts.sourceType,
        identifier: ts.identifier,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  return { enabledCount: enabled.length, results };
}

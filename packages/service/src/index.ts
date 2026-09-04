/**
 * JobPilot service layer — data access + business workflows.
 *
 * Dependency direction (enforced):
 *   apps/cli and (later) apps/web -> @JobPilot/service -> db/sources/ai -> core
 */

// Client
export { disconnectDb } from './db';

// Data access
export * from './skills';
export * from './jobs';
export * from './profile';
export * from './profileYaml';
export * from './analyses';
export * from './trackedSources';
export * from './scoring';

// Workflows
export * from './sync';
export * from './analyze';
export * from './matching';
export * from './ingest';

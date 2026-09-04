import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

// Default to the SQLite dev DB next to the schema when DATABASE_URL is unset,
// so the CLI and seeds work out of the box (no .env required for local dev).
if (!process.env.DATABASE_URL) {
  const here = fileURLToPath(import.meta.url);
  process.env.DATABASE_URL = `file:${resolve(dirname(here), '..', 'prisma', 'dev.db')}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
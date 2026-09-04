import { prisma } from '@JobPilot/db';

/** Close the shared Prisma connection (moved verbatim from apps/cli/src/db.ts). */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

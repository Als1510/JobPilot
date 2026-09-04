/**
 * Seed the database with deterministic reference data.
 *
 * M1 seeds the canonical Skill catalog (single source of truth in
 * @jobpilot/core). The candidate profile is loaded via the CLI
 * (`jobpilot profile import`) from profiles/master.yaml - we never
 * invent profile data in a seed.
 */
import 'dotenv/config';
import { getAllCanonicalSkills } from '@jobpilot/core';
import { prisma } from './client';

async function main() {
  const catalog = getAllCanonicalSkills();

  for (const entry of catalog) {
    const existing = await prisma.skill.findUnique({ where: { canonical: entry.canonical } });
    if (existing) {
      // Keep aliases in sync with the catalog on reseed.
      await prisma.skill.update({
        where: { canonical: entry.canonical },
        data: { category: entry.category, aliases: JSON.stringify(entry.aliases) },
      });
    } else {
      await prisma.skill.create({
        data: {
          canonical: entry.canonical,
          category: entry.category,
          aliases: JSON.stringify(entry.aliases),
        },
      });
    }
  }

  const count = await prisma.skill.count();
  console.log(`[seed] Skills ready: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
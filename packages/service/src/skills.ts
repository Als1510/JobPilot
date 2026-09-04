import { canonicalizeSkill } from '@JobPilot/core';
import { prisma } from '@JobPilot/db';

/** Upsert a skill row by canonical name, returning its id. */
export async function ensureSkill(canonical: string): Promise<string> {
  const { canonical: clean } = canonicalizeSkill(canonical);
  const row = await prisma.skill.upsert({
    where: { canonical: clean },
    create: { canonical: clean, category: 'other', aliases: '[]' },
    update: {},
  });
  return row.id;
}

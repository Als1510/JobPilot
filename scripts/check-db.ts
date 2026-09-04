import { prisma } from '../packages/db/src/client';
async function main() {
  const skills = await prisma.skill.count();
  const jobs = await prisma.job.count();
  console.log(`SKILLS=${skills} JOBS=${jobs}`);
}
main().finally(() => prisma.$disconnect());
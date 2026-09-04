import { prisma } from '../packages/db/src/client';
async function main() {
  const js = await prisma.jobSkill.deleteMany({});
  const mr = await prisma.matchResult.deleteMany({});
  const an = await prisma.jobAnalysis.deleteMany({});
  console.log(`cleared jobSkills=${js.count} matches=${mr.count} analyses=${an.count}`);
}
main().finally(() => prisma.$disconnect());
import { FakeProvider } from '../packages/ai/src/fake';
import { prisma } from '../packages/db/src/client';

async function main() {
  const jobs = await prisma.job.findMany({ take: 1 });
  const job = jobs[0]!;
  const fake = new FakeProvider();
  const raw = await fake.extractJobInfo(job.description, {
    title: job.title,
    location: job.location,
    company: job.company,
  });
  console.log(JSON.stringify(raw, null, 2));
  await prisma.$disconnect();
}
main();
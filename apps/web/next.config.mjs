import { config as loadDotEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Next.js runs from apps/web, so it does not auto-load the repository-root
// .env file. Load it explicitly so local dev (npm run dev / npm start) uses
// the same DATABASE_URL / LLM_PROVIDER as the CLI. Production platforms set
// environment variables directly, and a missing file is simply ignored.
const appDir = dirname(fileURLToPath(import.meta.url));
loadDotEnv({ path: resolve(appDir, '..', '..', '.env'), quiet: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The @jobpilot/* workspace packages ship TypeScript source (no build
  // output). Next.js must transpile them from source.
  transpilePackages: [
    '@jobpilot/core',
    '@jobpilot/db',
    '@jobpilot/sources',
    '@jobpilot/ai',
    '@jobpilot/service',
  ],
  // Prisma ships platform-specific engine binaries + a generated client that
  // must be resolved at runtime, never bundled by the Next.js server builder.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
};

export default nextConfig;
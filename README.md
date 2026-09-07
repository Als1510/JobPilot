# JobPilot

**An AI job-search & application assistant with human-in-the-loop control.**

JobPilot discovers job openings, analyzes job descriptions, matches them
against your real experience, ranks them, explains *why* a job scored the
way it did, and recommends whether to apply.

> **Current milestone: M1 — Job Intelligence** (JD → extract requirements →
> match against profile → score → explain score → recommend). No browser
> automation, resume tailoring, or auto-apply yet.

## Problem

Applying to jobs is high-volume and repetitive, but blanket "auto-apply"
bots are blind and often ignore whether you actually fit a role. JobPilot
is a personal, truthful assistant: it never invents skills or experience,
it explains *why* a job scored a certain way, and it never submits an
application without you reviewing it.

## Solution (M1)

A TypeScript monorepo with a pure core (normalization, deduplication,
deterministic explainable scoring), an LLM layer used **only** for JD
interpretation, a pluggable `JobSource` abstraction, and a CLI that
exposes the full pipeline:

```
fetch  →  normalize + dedup  →  analyze (LLM)  →  match (deterministic)  →  rank / explain / recommend
```

## Architecture

### Repository layout

```
JobPilot/
├── packages/
│   ├── core/      # pure domain: types, normalization, dedup fingerprint, scoring
│   ├── db/        # Prisma schema + client (SQLite now, Postgres in M3)
│   ├── sources/   # JobSource abstraction + Mock/Greenhouse/Jobvetta adapters
│   ├── ai/        # LanguageModel abstraction (Fake / OpenRouter / OpenAI-compatible)
│   └── service/   # data access + business workflows (ingest, analyze, match)
├── apps/
│   ├── cli/       # commander CLI: profile, jobs, analyze, match, rank, explain
│   └── web/       # Next.js App Router: UI + Route Handlers (/api/*)
├── config/        # scoring weights (explainable, tunable)
├── profiles/      # master candidate profile (source of truth)
├── .github/       # CI workflow
└── docs/          # architecture, ADRs, milestone status
```

### Module dependencies

```
apps/cli, apps/web → packages/service → packages/db, packages/sources, packages/ai → packages/core
```

Each layer depends only on the layers below it. `packages/core` has zero
dependencies (except `zod`) and contains all pure domain logic —
normalization, fingerprinting, scoring. The LLM is isolated behind the
`LanguageModel` interface in `packages/ai` and is used **only** for JD
interpretation. Matching is fully deterministic and explainable.

### Execution model

The web application is a **Next.js App Router** application. It is built with
`next build` and served in production with `next start`. The server honors
`process.env.PORT` (set automatically by most platforms) and binds to all
interfaces for external access.

The `build` script (`npm run build`) compiles the Next.js application for
production. The `start` script (`npm start`) runs the production server.

> **Note:** The CLI (`apps/cli`) still runs TypeScript source directly via `tsx`.
> Only the web application uses the Next.js build/start workflow.

### Data flow

```
Job Source (Mock/Greenhouse/Jobvetta/manual)
  → fetchJobs() returns RawJob[]
  → normalizeJob() canonicalizes strings, infers remote status, computes fingerprint
  → jobExists() checks (source, externalId) and fingerprint for dedup
  → saveJobs() persists to SQLite
  → analyzeJobs() → extractJobInfo() via LanguageModel → saveAnalysis()
  → computeMatches() → computeMatch() in core → saveMatch()
  → listRankedJobs() sorts by totalScore
  → explain() formats match result + recommendationFor() display tier
  → Next.js Route Handlers serve JSON to the React frontend
```

The frontend (Overview, Discover, Profile, Job Detail) is built with React
and CSS Modules. It consumes the same `/api/*` endpoints.

## Prerequisites

- **Node.js ≥ 20** (specified in `engines`)
- npm (bundled with Node)

No external services required. The default configuration uses SQLite (file-based)
and the Fake LLM provider (offline, deterministic).

## Installation

```bash
# 1. Install dependencies
npm ci

# 2. Set up the database (generate client, migrate, seed skill catalog)
npm run setup

# 3. (Optional) Copy and edit environment config
cp .env.example .env
```

`.env` is git-ignored. The application works with the defaults in
`.env.example` — no edits needed for the demo.

## Running the CLI

```bash
npm start -- <command> [options]
# or
npm run cli -- <command> [options]
```

Both commands are equivalent. Arguments after `--` are forwarded to the CLI.

## Running the web application

```bash
npm run dev
```

Starts the Next.js development server at `http://localhost:3000`. For production,
build with `npm run build` and start with `npm start`.

## Command reference

### Profile management

```bash
npm start -- profile import profiles/master.yaml
```

Imports your master candidate profile from YAML. This is required before
matching. The profile defines your skills, target roles, locations, and
remote preference.

### Job discovery

```bash
# Fetch from the offline Mock source (no API key needed)
npm start -- jobs fetch --source mock

# Ingest a job description from a text file
npm start -- jobs ingest path/to/jd.txt --title "Frontend Engineer" --company "Acme"

# List all stored jobs
npm start -- jobs list

# Sync all enabled tracked sources
npm start -- jobs sync
```

### Analysis and matching

```bash
# Run AI extraction on all unanalyzed jobs
npm start -- analyze

# Compute matches for all analyzed jobs
npm start -- match
```

### Ranking and explanation

```bash
# List jobs ranked by match score (highest first)
npm start -- rank

# Explain why a job scored the way it did
npm start -- explain <jobId>
```

The `explain` command shows the overall score, a recommendation string,
per-category breakdown with strengths/gaps, and matched/missing skills.

## Scripts

| Script | Description |
|---|---|
| `npm start` | Start the Next.js production server (`next start`) |
| `npm run dev` | Start the Next.js development server (`next dev`) |
| `npm run web` | Alias for `npm start` |
| `npm run cli -- <cmd>` | Run the CLI (`tsx apps/cli/src/index.ts`) |
| `npm run setup` | Install deps + generate Prisma client + migrate + seed |
| `npm run db:generate` | Generate Prisma client from schema |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed the canonical skill catalog |
| `npm run typecheck` | Typecheck all packages (`tsc --noEmit`) |
| `npm test` | Run all tests across all packages |
| `npm run build` | Build the Next.js application for production |

## AI provider

JobPilot uses an LLM **only** for job description interpretation
(`LanguageModel.extractJobInfo`). Matching, scoring, and explanation are
fully deterministic and never touch an LLM.

### Default: Fake provider (offline)

```
LLM_PROVIDER=Fake
```

The Fake provider is deterministic and requires no API key. It extracts
skills using the canonical catalog and signal-word heuristics. This is the
default for development and demos.

### Optional: Real LLM provider

To use a real LLM, set in `.env`:
```
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-...
LLM_MODEL=openai/gpt-4o-mini
```

Any OpenAI-compatible endpoint works (OpenRouter, DeepSeek, NVIDIA, vLLM,
LM Studio). The provider uses structured outputs and validates all
responses with Zod before use.

## Testing

```bash
npm test
```

Tests run across all packages using Vitest. Service and source tests use
a temporary SQLite database (auto-provisioned by the Vitest config) so the
development database is never mutated. The Fake LLM provider is used by
default — no API keys required for testing.

## Build

```bash
npm run build
```

Builds the Next.js application for production. This compiles the React
frontend, Route Handlers, and optimizes assets. The output is in `.next/`.

After building, start the production server with `npm start`.

> **Note:** The CLI does not require a build step — it runs TypeScript source
> directly via `tsx`. Only the web application uses the build/start workflow.

## CI

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push
and pull request:

```
npm ci → db:generate → typecheck → test → build
```

All checks must pass. No API keys or secrets required.

## Security

Secrets live only in `.env` (git-ignored). Never commit credentials. Treat
candidate data as private to you.

## Deployment

JobPilot M1 is a **Next.js application**. It is built with `npm run build`
and served in production with `npm start`. The entire application — UI,
API, and frontend — runs as a single service.

### Architecture

```
Browser
  ↓
Railway (Next.js: UI + Route Handlers)
  ↓
SQLite on Railway persistent volume (/data)
```

### Prerequisites
- Node.js >= 20
- A persistent filesystem (for SQLite)

### Environment variables
| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Most platforms set this automatically |
| `DATABASE_URL` | `file:./dev.db` | SQLite path; use a persistent path in production |
| `NODE_ENV` | unset | Set to `production` to hide internal error details |
| `LLM_PROVIDER` | `Fake` | Works offline; no API key needed |

### Railway deployment

1. Create a new Railway project and connect this repository.
2. Set the **Build Command** to: `npm run build`
3. Set the **Start Command** to: `npm start`
4. Add a **Persistent Volume**:
   - Mount path: `/data`
   - This is where SQLite stores its database file.
5. Set environment variables:
   ```
   DATABASE_URL=file:/data/jobpilot.db
   NODE_ENV=production
   LLM_PROVIDER=Fake
   ```
6. Railway runs `npm install` automatically. The `postinstall` script generates
   the Prisma client and applies migrations to the persistent database.
7. The server binds to `process.env.PORT` (Railway sets this automatically).

### Database initialization

The `postinstall` script handles database setup automatically:
- `prisma generate` — generates the Prisma client from the schema
- `prisma migrate deploy` — applies all existing migrations (non-interactive)

No manual database setup is required.

### Production data behavior

- An **empty database** renders a usable dashboard with an empty-state message.
- Missing profile, job analysis, or match data is handled gracefully.
- The app does **not** seed demo data automatically — jobs are added via the
  Discover page (fetch from source or paste a description).
- The app does not assume any pre-existing data.

### Limitations

- **Single-user/demo scope**: SQLite with a persistent volume. Suitable for one
  user. Multi-user SaaS requires PostgreSQL (M3 scope).
- **No authentication**: anyone with the URL can access the API.
- **No browser automation or auto-apply**: M1 is job intelligence only.

## Profile data

`profiles/master.yaml` is a **template** marked DRAFT with placeholder values.
It contains no real personal data. Before a real job search, replace it with
your actual experience — and never commit real personal information to a public
repository.

## License

JobPilot is licensed under the MIT License. See [LICENSE](LICENSE) for details.
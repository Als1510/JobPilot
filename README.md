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
│   └── cli/       # commander CLI: profile, jobs, analyze, match, rank, explain
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

M1 is a TypeScript CLI executed through [`tsx`](https://github.com/privatenumber/tsx).
TypeScript source is transpiled and run directly — no separate compilation
step is required to use the application. This is the standard execution
model for the project.

The `build` script is a **validation/type-safety gate** only. It runs
`tsc --noEmit` across all packages to verify type correctness. It does not
emit JavaScript. To run the CLI, use `npm start` or `npm run cli`.

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
```

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
npm run web
```

Starts an Express-based HTTP API server and serves the static frontend at
`http://localhost:3000`. The web application exposes the same M1 pipeline
(profile, jobs, analyze, match, rank, explain) over HTTP.

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
| `npm start -- <cmd>` | Run the CLI (alias for `npm run cli`) |
| `npm run cli -- <cmd>` | Run the CLI |
| `npm run web` | Start the web API server (`tsx apps/web/src/index.ts`) |
| `npm run setup` | Install deps + generate Prisma client + migrate + seed |
| `npm run db:generate` | Generate Prisma client from schema |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed the canonical skill catalog |
| `npm run typecheck` | Typecheck all packages (`tsc --noEmit`) |
| `npm test` | Run all tests across all packages |
| `npm run build` | Validation gate — typechecks all packages (no JS emitted) |

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

Runs `tsc --noEmit` across all packages. This is a **type-safety validation
gate** — it verifies type correctness but does not emit JavaScript. The
application runs TypeScript source directly via `tsx`.

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

## Profile data

`profiles/master.yaml` is a **template** marked DRAFT with placeholder values.
It contains no real personal data. Before a real job search, replace it with
your actual experience — and never commit real personal information to a public
repository.

## License

JobPilot is licensed under the MIT License. See [LICENSE](LICENSE) for details.
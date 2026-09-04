# JobPilot

**An AI job-search & application assistant with human-in-the-loop control.**

JobPilot discovers job openings, analyzes job descriptions, matches them
against your real experience, ranks them, prepares truthful tailored
applications, fills them out, and **always stops for explicit human approval
before submitting**.

> **Current milestone: M1 — Job Intelligence** (JD → extract requirements →
> match against profile → score → explain score). No browser automation yet.

## Problem

Applying to jobs is high-volume and repetitive, but blanket "auto-apply"
bots are blind and often ignore whether you actually fit a role. JobPilot
is a personal, truthful assistant: it never invents skills or experience,
it explains *why* a job scored a certain way, and it never submits an
application without you reviewing it.

## Solution (M1)

A TypeScript monorepo with a pure core (normalization, deduplication,
deterministic explainable scoring), an LLM layer used **only** for JD
interpretation, a pluggable `JobSource` abstraction, and a CLI that previews
the future agent's tool surface:

```
fetch  →  normalize + dedup  →  analyze (LLM)  →  match (deterministic)  →  rank / explain
```

## Repository layout

```
jobpilot/
├── packages/
│   ├── core/      # pure domain: types, normalization, dedup fingerprint, scoring
│   ├── db/        # Prisma schema + client (SQLite now, Postgres in M3)
│   ├── sources/   # JobSource abstraction + Mock source (Greenhouse later)
│   └── ai/        # LanguageModel abstraction (OpenRouter / OpenAI-compatible / Fake)
├── apps/
│   └── cli/       # commander CLI: profile, jobs, analyze, match, rank, explain
├── profiles/      # master candidate profile (source of truth)
├── config/        # scoring weights (explainable, tunable)
└── docs/          # architecture, ADRs, milestone status
```

## Getting started

```bash
npm run setup                 # install, generate Prisma client, migrate, seed
cp .env.example .env          # then edit LLM_PROVIDER / keys
npm run cli -- jobs fetch --source mock
npm run cli -- analyze --all
npm run cli -- match --all
npm run cli -- rank
```

## Documentation

- [Architecture](docs/architecture.md)
- [Decision records](docs/adr/)
- [Milestone status / source of truth](docs/STATUS.md)

## Security

Secrets live only in `.env` (git-ignored). Never commit credentials. Treat
candidate data as private to you.
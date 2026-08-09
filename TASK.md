# TASK.md — Air Quality Intelligence Platform

Workflow: AI Hero v1 (template-workflow-dev). Status updated per phase.

## Phase 0 — Scaffolding
- [x] Monorepo layout: packages/orchestrator, packages/dashboard, pipeline, dbt, app, supabase
- [x] Root via npm workspaces: orchestrator + dashboard wiring
- [x] .gitignore (env, node_modules, dbt artifacts, DuckDB, supabase temp)
- [x] Deploy configs: Dockerfile (orchestrator/dashboard/app), docker-compose.yml, railway.json
- [ ] Git repo initialized + pushed to GitHub (pending user go-ahead)

## Phase 1 — PRD / Design (skipped; template carried over from pipefitter)
- [x] PRD context inherited; scoped to Indonesia ISPU air-quality dashboard

## Phase 2 — Design system (skipped; inherited styles, minimal new UI)
- [x] Shiny app + dashboard follow existing flatly/light theme

## Phase 3 — Task breakdown
- [x] This file

## Phase 4 — TDD Engineering (Local)
### 4A Backend (OpenAQ → DuckDB → dbt gold → Supabase serving)
- [x] pipeline/openaq-air-quality/01_extract_bronze.py (OpenAQ v3 → bronze)
- [x] pipeline/openaq-air-quality/02_dbt_run.py (bronze → silver → gold)
- [x] pipeline/openaq-air-quality/03_dbt_test.py (dbt test runner)
- [x] pipeline/openaq-air-quality/04_sync_gold.py (gold → Supabase serving, upsert)
- [x] dbt project: profiles generation, sources, staging, intermediate, marts, schema tests
- [x] supabase/migrations/001_serving_schema.sql (serving schema + reader grants)
- [x] pipeline tests: python compile + sync path reviewed

### 4B Frontend
- [x] Shiny/Rhino app: view/ui.R, logic/server.R, logic/data.R, logic/aqi.R
- [x] ISPU computation tests (app/tests/testthat/test-aqi.R) — 11 passing
- [x] Dashboard (Next.js) + Orchestrator (node) build/lint clean
- [x] Unit tests: testthat R aqi => green

## Phase 5 — DB Deployment Choice + Integration
- [x] User chose Option 1 (Supabase Cloud Staging)
- [x] Created staging project `air-quality-staging` (ref afldkpqyufgoavbmoydd, ap-southeast-1, free tier)
- [x] Applied 001_serving_schema.sql to staging (serving schema + dashboard_reader role)
- [x] .env.local wired with staging ref/pooler; DB password marked CHANGE_ME (dashboard only)
- [ ] Fill staging DB password into .env.local / Railway / Vercel
- [ ] Run pipeline against staging (extract → dbt → sync to serving)
- [ ] Vercel preview deploy pointing at staging DB

## Phase 6 — Code Audit + E2E + Commit
- [ ] review skill scan (diff vs PRD/DESIGN)
- [ ] Playwright E2E against staging (or local)
- [ ] npm + R tests all green
- [ ] Git commit + push (after user clearance)
- [ ] Vercel preview deploy

## Post-Processing/Ops Tasks
- [ ] Optional: Sentry error tracking (deferred — not approved)
# Air Quality Dashboard

> Air Quality Dashboard that pulls measurements from
> [OpenAQ](https://docs.openaq.org) for 7 Indonesian cities, runs a DuckDB
> medallion (bronze → silver → gold) with dbt, mirrors the Gold layer into
> Supabase Postgres, and serves it through a Rhino/Shiny dashboard — refreshed
> every 15 minutes.

## Architecture

```
OpenAQ API ──▶  Orchestrator (Express :3001)
               every 15 min, spawns 4 stages (failure stops downstream)
                   │
                   ▼
       01_extract_bronze.py ──▶  DuckDB   bronze.measurements
       02_dbt_run.py       ──▶  dbt      silver → gold (marts)
       03_dbt_test.py      ──▶  dbt      data quality tests
       04_sync_gold.py     ──▶  Supabase serving.* (Gold mirror + ingestion_metadata)
                   │
   metadata DB (pipeline_runs/stage_runs) ◄── Dashboard (Next.js :3000)
                   
   Supabase serving.* ◄── Shiny/Rhino app (:3838)  airqualitydashboard.fajardwnugroho.com
```

Two Postgres-backed stores on one Supabase project:
- **pipefitter_meta** — run history, stage logs, statuses (drives the dashboard)
- **serving** — Gold marts mirrored from DuckDB (drives Shiny, read-only)

Cities (locality-based station resolution): Jakarta, Bandung, Surabaya, Medan,
Denpasar, Yogyakarta, Semarang. Pollutants: **PM2.5, PM10, O3, NO2**.

## Quick Start

```bash
git clone https://github.com/fajardwnugroho/air-quality-dashboard.git
cd air-quality-dashboard
npm install

cp .env.example .env.local
# 1. OPENAQ_API_KEY: create a free account at https://explore.openaq.org/register
#                    and copy your key from https://explore.openaq.org/account
# 2. SUPABASE_DB_URL / SERVING_DB_URL: your Supabase Postgres connection string

# Orchestrator (API + scheduler)
npm run dev --workspace=packages/orchestrator

# Dashboard (browser UI)
npm run dev --workspace=packages/dashboard
```

### Trigger the pipeline manually

```bash
curl -X POST http://localhost:3001/api/run/openaq-air-quality
```

## Project Structure

```
├── packages/
│   ├── orchestrator/          # Express API + cron scheduler + runner + notifier
│   │   └── src/
│   │       ├── index.js       # Entry point, routes
│   │       ├── config.js      # Pipeline definitions
│   │       ├── runner.js      # Subprocess spawn with retry + backoff
│   │       ├── scheduler.js   # Cron scheduling + stuck run recovery
│   │       ├── db.js          # Metadata store (SQLite local, Postgres via DATABASE_URL)
│   │       └── notifier.js    # Slack failure alerts
│   ├── dashboard/             # Next.js UI (shadcn/ui) — run history
│   └── scripts/               # (placeholder — pipeline lives at repo-root pipeline/)
├── pipeline/
│   └── openaq-air-quality/
│       ├── 01_extract_bronze.py   # OpenAQ → DuckDB bronze (idempotent, incremental)
│       ├── 02_dbt_run.py          # subprocess dbt run
│       ├── 03_dbt_test.py         # subprocess dbt test
│       └── 04_sync_gold.py        # DuckDB gold → Supabase serving schema
├── dbt/                       # dbt project (DuckDB target)
│   └── models/{staging,intermediate,marts}/
├── app/                       # Rhino/Shiny dashboard
│   ├── main.R + view/ + logic/ + static/ + tests/testthat/
├── data/                      # air_quality.duckdb (gitignored)
├── supabase/migrations/       # serving schema DDL
├── Dockerfile.*, docker-compose.yml, railway.json
└── LICENSE, README.md
```

## Pipeline

| # | Stage | Script | Target |
|---|-------|--------|--------|
| 1 | extract_bronze | `01_extract_bronze.py` | `bronze.measurements`, `bronze.ingestion_metadata` |
| 2 | dbt_run | `02_dbt_run.py` | silver + gold marts (DuckDB) |
| 3 | dbt_test | `03_dbt_test.py` | dbt tests (`not_null`, `accepted_values`, `relationships`) |
| 4 | sync_gold | `04_sync_gold.py` | Supabase `serving.*` |

Failure of any stage stops downstream stages and notifies Slack
(`SLACK_WEBHOOK_URL`).

## dbt Models

- **Staging**: `stg_measurements`, `stg_locations`, `stg_stations`
- **Intermediate**: `int_measurements_hourly` (dedup, type-cast, timezone-aware)
- **Marts**: `dim_station`, `dim_location`, `dim_date`,
  `fct_air_quality_measurements`, `mart_air_quality_current`,
  `mart_air_quality_daily`, `mart_station_comparison`,
  `mart_pollution_anomalies`

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/run/:pipelineId` | Trigger a pipeline run |
| `GET` | `/api/pipelines` | Latest run per pipeline |
| `GET` | `/api/pipelines/definitions` | Pipeline configs |
| `GET` | `/api/pipelines/status` | Paused state per pipeline |
| `GET` | `/api/runs` | Run history |
| `GET` | `/api/runs/:runId` | Run detail + stage attempts |
| `GET` | `/health` | Health check |

## Deployment

- Production: Railway — orchestrator :3001, dashboard :3000, shiny :3838, one
  Supabase project (two schemas). See `railway.json`.
- Shiny runs read-only against the `serving` schema — red/black deploys of the
  dashboard never touch the pipeline.
- dbt runs inside the orchestrator container (Python `dbt-duckdb` wrapper
  stages), so no separate dbt runtime is needed.

## License

MIT
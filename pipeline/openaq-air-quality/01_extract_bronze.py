#!/usr/bin/env python3
"""
01_extract_bronze.py — OpenAQ v3 → DuckDB bronze.

Fetches air quality measurements for configured Indonesian cities and
pollutants, resolving monitoring stations by locality, and writes them into
the DuckDB warehouse in the `bronze` schema (idempotent, incremental).

Stores location metadata (bronze.locations) and per-station ingestion
watermarks (bronze.ingestion_metadata) so re-runs only pull new data.

Environment:
  OPENAQ_API_KEY      required — free key from https://explore.openaq.org/account
  OPENAQ_BASE_URL     default https://api.openaq.org/v3
  OPENAQ_COUNTRY      default ID
  OPENAQ_CITIES       comma-separated, default 7 Indonesian cities
  OPENAQ_PARAMETERS   comma-separated, default pm25,pm10,o3,no2
  DUCKDB_PATH         default <repo>/data/air_quality.duckdb
  OPENAQ_BACKFILL_DAYS initial watermark window, default 60

Exit codes: 0 success, 1 fatal (config/auth), 2 transient (rate limit).

Rate limits: 60 req/min, 2000 req/hour. We pace to ~1 req/s and honor
x-ratelimit-* headers with backoff on 429.
"""

import json
import math
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CITIES = "Jakarta,Bandung,Surabaya,Medan,Denpasar,Yogyakarta,Semarang"
DEFAULT_PARAMETERS = "pm25,pm10,o3,no2"

import duckdb
import requests  # noqa: E402

BASE_URL = os.environ.get("OPENAQ_BASE_URL", "https://api.openaq.org/v3").rstrip("/")
API_KEY = os.environ.get("OPENAQ_API_KEY", "").strip()
COUNTRY = os.environ.get("OPENAQ_COUNTRY", "ID").strip()
CITIES = [c.strip() for c in os.environ.get("OPENAQ_CITIES", DEFAULT_CITIES).split(",") if c.strip()]
PARAMETERS = [p.strip() for p in os.environ.get("OPENAQ_PARAMETERS", DEFAULT_PARAMETERS).split(",") if p.strip()]
DUCKDB_PATH = os.environ.get("DUCKDB_PATH") or str(REPO_ROOT / "data" / "air_quality.duckdb")
BACKFILL_DAYS = int(os.environ.get("OPENAQ_BACKFILL_DAYS", "60"))

TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


class RateLimiter:
    """Pace requests to ~1 req/s; back off when the API demands it."""

    def __init__(self, min_interval=1.1):
        self.min_interval = min_interval
        self._last = 0.0

    def wait(self):
        now = time.monotonic()
        delta = now - self._last
        if delta < self.min_interval:
            time.sleep(self.min_interval - delta)
        self._last = time.monotonic()


def http_get(session, path, params, limiter):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY

    for attempt in range(6):
        limiter.wait()
        resp = session.get(url, headers=headers, params=params, timeout=30)

        if resp.status_code == 200:
            return resp.json()

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else float(2 ** attempt) + 2
            wait = min(delay, 45)
            print(f"  [429] rate limited, waiting {wait:.0f}s...", flush=True)
            time.sleep(wait)
            continue

        if resp.status_code in (400, 401, 403):
            body = resp.text[:300]
            print(f"  [HTTP {resp.status_code}] {body}", flush=True)
            return None

        # Transient (502/503/timeouts) — retry with backoff.
        time.sleep(float(2 ** attempt) + 1)

    print(f"  [error] too many failures for {path}", flush=True)
    raise SystemExit(2)


def paginated(session, path, params, limiter, page_size=1000):
    """Yield result lists across pages of the v3 pagination API."""
    page = 1
    while True:
        p = dict(params)
        p["limit"] = page_size
        p["page"] = page
        data = http_get(session, path, p, limiter)
        if data is None:
            return
        results = data.get("results", [])
        yield results
        meta = data.get("meta", {})
        pages = meta.get("pageCount") or meta.get("totalPages")
        if not results:
            return
        if pages is not None and page >= pages:
            return
        # Safety: also stop when server returns a short page.
        if len(results) < page_size:
            return
        page += 1


def to_utc_iso(dt_str):
    """Normalize an ISO datetime string to UTC ISO (YYYY-MM-DDTHH:MM:SSZ)."""
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).strftime(TIME_FORMAT)
    except ValueError:
        return dt_str


def ensure_schema(con):
    con.execute("CREATE SCHEMA IF NOT EXISTS bronze")
    con.execute("""
        CREATE TABLE IF NOT EXISTS bronze.locations (
            location_id       BIGINT PRIMARY KEY,
            city              VARCHAR,
            locality          VARCHAR,
            name              VARCHAR,
            country           VARCHAR,
            latitude          DOUBLE,
            longitude         DOUBLE,
            sensors_count     INTEGER,
            parameters        JSON,
            source            VARCHAR DEFAULT 'openaq',
            fetched_at_utc    TIMESTAMPTZ DEFAULT now()
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS bronze.measurements (
            location_id      BIGINT,
            sensor_ids       VARCHAR,
            parameter        VARCHAR,
            unit             VARCHAR,
            value            DOUBLE,
            datetime_utc     TIMESTAMPTZ,
            datetime_local   TIMESTAMPTZ,
            ingest_run_id    VARCHAR,
            fetched_at_utc   TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (location_id, sensor_ids, parameter, datetime_utc)
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS bronze.ingestion_metadata (
            key                VARCHAR PRIMARY KEY,
            city               VARCHAR,
            location_id        BIGINT,
            last_measurement_utc TIMESTAMPTZ,
            last_run_at        TIMESTAMPTZ DEFAULT now()
        )
    """)


def discover_locations(session, con, limiter):
    con.execute("DELETE FROM bronze.locations")
    for city in CITIES:
        params = {"country": COUNTRY, "city": city, "parameters": ",".join(PARAMETERS)}
        found = 0
        for batch in paginated(session, "/locations", params, limiter, page_size=100):
            for loc in batch:
                coords = loc.get("coordinates") or {}
                con.execute(
                    """
                    INSERT INTO bronze.locations
                        (location_id, city, locality, name, country, latitude,
                         longitude, sensors_count, parameters)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        loc["id"],
                        city,
                        loc.get("locality"),
                        loc.get("name"),
                        loc.get("country"),
                        coords.get("latitude"),
                        coords.get("longitude"),
                        len(loc.get("sensors", []) or []),
                        json.dumps([p.get("name") for p in (loc.get("parameters") or [])]),
                    ],
                )
                found += 1
        print(f"  {city}: {found} locations", flush=True)


def load_measurements(session, con, limiter, run_id):
    locations = con.execute(
        "SELECT location_id, city FROM bronze.locations ORDER BY location_id"
    ).fetchall()

    for location_id, city in locations:
        row = con.execute(
            "SELECT last_measurement_utc FROM bronze.ingestion_metadata WHERE key = ?",
            [f"{city}:{location_id}"],
        ).fetchone()

        if row and row[0]:
            datetime_from = (row[0] - timedelta(seconds=1)).strftime(TIME_FORMAT)
        else:
            datetime_from = (datetime.now(timezone.utc) - timedelta(days=BACKFILL_DAYS)).strftime(TIME_FORMAT)

        params = {
            "location_id": location_id,
            "parameters": ",".join(PARAMETERS),
            "datetime_from": datetime_from,
            "limit": 1000,
        }

        inserted = 0
        last_seen = None
        for batch in paginated(session, "/measurements", params, limiter):
            rows_needed = True
            for m in batch:
                value = m.get("value")
                dt_utc = to_utc_iso((m.get("datetime") or {}).get("utc"))
                if value is None or not dt_utc:
                    continue
                con.execute(
                    """
                    INSERT INTO bronze.measurements
                        (location_id, sensor_ids, parameter, unit, value,
                         datetime_utc, datetime_local, ingest_run_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (location_id, sensor_ids, parameter, datetime_utc)
                    DO NOTHING
                    """,
                    [
                        location_id,
                        ",".join(str(s) for s in (m.get("sensors_id") or [])),
                        (m.get("parameter") or {}).get("name", m.get("parameter")),
                        (m.get("parameter") or {}).get("units", m.get("unit")),
                        value,
                        dt_utc,
                        to_utc_iso((m.get("datetime") or {}).get("local")),
                        run_id,
                    ],
                )
                inserted += 1
                if last_seen is None or dt_utc > last_seen:
                    last_seen = dt_utc

        con.execute(
            """
            INSERT INTO bronze.ingestion_metadata
                (key, city, location_id, last_measurement_utc)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (key) DO UPDATE SET
                last_measurement_utc = excluded.last_measurement_utc
            """,
            [f"{city}:{location_id}", city, location_id, last_seen or datetime_from],
        )
        print(f"  {city}/{location_id}: +{inserted} measurements", flush=True)


def main():
    if not API_KEY:
        print(
            "FATAL: OPENAQ_API_KEY is not set. Get a free key at "
            "https://explore.openaq.org/register",
            file=sys.stderr,
        )
        raise SystemExit(1)

    if not CITIES or not PARAMETERS:
        print("FATAL: set OPENAQ_CITIES and OPENAQ_PARAMETERS", file=sys.stderr)
        raise SystemExit(1)

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    limiter = RateLimiter()

    Path(DUCKDB_PATH).parent.mkdir(parents=True, exist_ok=True)
    print(f"Extracting OpenAQ → DuckDB bronze (run {run_id})", flush=True)
    print(f"  cities: {', '.join(CITIES)}", flush=True)
    print(f"  parameters: {', '.join(PARAMETERS)}", flush=True)

    with duckdb.connect(DUCKDB_PATH) as con:
        ensure_schema(con)
        with requests.Session() as session:
            print("Discovering locations...", flush=True)
            discover_locations(session, con, limiter)
            print("Loading measurements...", flush=True)
            load_measurements(session, con, limiter, run_id)

        counts = con.execute(
            "SELECT count(*) FROM bronze.measurements"
        ).fetchone()[0]
        print(f"Done. bronze.measurements rows: {counts}", flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
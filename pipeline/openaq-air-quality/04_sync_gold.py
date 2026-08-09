#!/usr/bin/env python3
"""
04_sync_gold.py — mirror DuckDB gold marts into Supabase Postgres (serving).

Reads the Gold marts produced by dbt from the DuckDB warehouse and upserts
them (idempotent, ON CONFLICT) into a Supabase Postgres `serving` schema,
which is the read-only store that feeds the Shiny/Rhino dashboard.

Connection is taken from CLIENT_DB_URL (injected by the orchestrator runner):
  postgresql://user:pass@host:6543/db

Tables synced (name derived per mart):
  serving.mart_air_quality_current
  serving.mart_air_quality_daily
  serving.mart_station_comparison
  serving.mart_pollution_anomalies
  serving.dim_station
  serving.dim_location
  serving.ingestion_metadata

Exit codes: 0 ok, 1 fatal.
"""

import os
import sys
from pathlib import Path

import duckdb
import pg8000.native  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]

# mart (dbt table) → (key columns) that drive ON CONFLICT upserts.
MART_KEYS = {
    "mart_air_quality_current": ["city", "pollutant"],
    "mart_air_quality_daily": ["city", "pollutant", "date_day"],
    "mart_station_comparison": ["station_id", "pollutant"],
    "mart_pollution_anomalies": ["city", "pollutant", "date_day"],
    "dim_station": ["station_id"],
    "dim_location": ["city"],
}


def parse_db_url(url):
    """Parse a standard postgres:// connection URL into kwargs for pg8000."""
    import urllib.parse

    parsed = urllib.parse.urlparse(url)
    kwargs = {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": (parsed.path or "/postgres").lstrip("/") or "postgres",
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
    }
    if parsed.query and "sslmode=" not in parsed.query:
        # pg8000 expects an ssl.SSLContext, not a string mode. Supabase's
        # pooler behind a load balancer may present a CA chain the local
        # store can't verify; `require` semantics = encrypt, don't pin CA.
        import ssl

        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
    return kwargs


def ensure_schema(con, schema="serving"):
    con.run(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    con.run(f'GRANT USAGE ON SCHEMA "{schema}" TO anon, authenticated')


def lock_read_only(con, schema, table):
    """Enable RLS with a read-only SELECT policy so anon/authenticated can
    read but never write the dynamically-created serving tables."""
    con.run(f'ALTER TABLE "{schema}"."{table}" ENABLE ROW LEVEL SECURITY')
    con.run(f'ALTER TABLE "{schema}"."{table}" FORCE ROW LEVEL SECURITY')
    con.run(f'DROP POLICY IF EXISTS serving_read_only ON "{schema}"."{table}"')
    con.run(
        f'CREATE POLICY serving_read_only ON "{schema}"."{table}" '
        "FOR SELECT TO anon, authenticated USING (true)"
    )


def upsert_table(con, schema, table, df, key_cols):
    """Create-if-needed and upsert a pandas DataFrame into Postgres."""
    if df is None or len(df) == 0:
        print(f"  [sync] {table}: empty, skipping", flush=True)
        return

    cols = list(df.columns)
    col_list = ", ".join(f'"{c}"' for c in cols)
    key_list = ", ".join(f'"{c}"' for c in key_cols if c in cols)
    if not key_list:
        key_list = f'"{cols[0]}"'

    create_sql = f'CREATE TABLE IF NOT EXISTS "{schema}"."{table}" (\n'
    types = []
    for c in cols:
        sample = df[c]
        if hasattr(sample, "dtype"):
            dtype = str(sample.dtype)
            if "int" in dtype:
                pg_type = "BIGINT"
            elif "float" in dtype:
                pg_type = "DOUBLE PRECISION"
            elif "datetime" in dtype or "date" in dtype:
                pg_type = "TIMESTAMPTZ"
            else:
                pg_type = "TEXT"
        else:
            pg_type = "TEXT"
        types.append(f'  "{c}" {pg_type}')
    # Enforce a unique constraint on the conflict key columns so ON CONFLICT
    # works even on a fresh table.
    constraints = [
        f'  PRIMARY KEY ({key_list})'
    ]
    create_sql += ",\n".join(types + constraints) + "\n)"
    con.run(create_sql)
    lock_read_only(con, schema, table)

    set_clause = ", ".join(
        f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in key_cols
    )
    placeholders = ", ".join(f"${i}" for i in range(1, len(cols) + 1))
    insert_sql = f"""
        INSERT INTO "{schema}"."{table}" ({col_list})
        VALUES ({placeholders})
        ON CONFLICT ({key_list}) DO UPDATE SET {set_clause}
    """

    rows = list(df.itertuples(index=False, name=None))
    con.run("BEGIN")
    try:
        for row in rows:
            params = {f"p{i}": v for i, v in enumerate(row)}
            con.run(insert_sql, **params)
        con.run("COMMIT")
        print(f"  [sync] {table}: upserted {len(rows)} rows", flush=True)
    except Exception:
        con.run("ROLLBACK")
        raise


def main():
    duckdb_path = Path(os.environ.get("DUCKDB_PATH", REPO_ROOT / "data" / "air_quality.duckdb"))
    db_url = os.environ.get("CLIENT_DB_URL", "").strip()
    if not db_url:
        print("FATAL: CLIENT_DB_URL not set (Supabase serving DB)", file=sys.stderr)
        raise SystemExit(1)

    print(f"[sync] DuckDB={duckdb_path}", flush=True)
    print("[sync] target=Supabase serving schema", flush=True)

    with duckdb.connect(str(duckdb_path)) as ddb, pg8000.native.Connection(
        **parse_db_url(db_url)
    ) as con:
        ensure_schema(con)

        for table, key_cols in MART_KEYS.items():
            # DuckDB marts live under schema 'gold' (custom) or 'main'.
            df = None
            for schema in ("gold", "main_gold", "main", ""):
                qualified = f"{schema}.{table}" if schema else table
                exists = ddb.execute(
                    f"SELECT count(*) FROM information_schema.tables "
                    f"WHERE table_name = ? AND table_schema = ?",
                    [table, schema or "main"],
                ).fetchone()
                if exists and exists[0] > 0:
                    if schema:
                        df = ddb.execute(f'SELECT * FROM "{schema}"."{table}"').df()
                    else:
                        df = ddb.execute(f'SELECT * FROM "{table}"').df()
                    break
            if df is None:
                print(f"  [sync] {table}: not found in DuckDB, skipping", flush=True)
                continue
            upsert_table(con, "serving", table, df, key_cols)

        # Freshness metadata: surface the latest watermark + row counts so the
        # dashboard and Shiny can show "last updated" badges without touching
        # DuckDB directly.
        meta_df = ddb.execute("""
            SELECT 'measurements' AS key,
                   max(fetched_at_utc) AS last_update,
                   count(*)           AS record_count
            FROM bronze.measurements
        """).df()
        upsert_table(con, "serving", "ingestion_metadata", meta_df, ["key"])

    print("[sync] done", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
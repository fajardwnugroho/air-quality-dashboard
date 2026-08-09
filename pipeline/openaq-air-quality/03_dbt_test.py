#!/usr/bin/env python3
"""
03_dbt_test.py — run dbt tests against the gold / silver models.

Wraps `dbt test` as a Python stage. Non-zero exit → orchestrator flags the
pipeline as failed, so quality gates happen before the Gold→Postgres sync.

Environment:
  DBT_PROJECT_DIR  default <repo>/dbt
  DBT_PROFILES_DIR default <repo>/dbt
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def main():
    project_dir = Path(os.environ.get("DBT_PROJECT_DIR", REPO_ROOT / "dbt"))
    profiles_dir = Path(os.environ.get("DBT_PROFILES_DIR", REPO_ROOT / "dbt"))

    # Reuse the same profile generation as the run stage.
    duckdb_path = Path(os.environ.get("DUCKDB_PATH", REPO_ROOT / "data" / "air_quality.duckdb"))
    from importlib import util

    run_mod_path = Path(__file__).with_name("02_dbt_run.py")
    spec = util.spec_from_file_location("dbt_run_helpers", run_mod_path)
    helpers = util.module_from_spec(spec)
    spec.loader.exec_module(helpers)
    helpers.ensure_profiles(profiles_dir, duckdb_path)

    env = dict(os.environ)
    env["DBT_PROFILES_DIR"] = str(profiles_dir)

    print(f"[dbt-test] project-dir={project_dir}", flush=True)
    result = subprocess.run(
        ["dbt", "test", "--project-dir", str(project_dir)],
        cwd=str(project_dir),
        env=env,
        capture_output=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
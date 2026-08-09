#!/usr/bin/env python3
"""
02_dbt_run.py — run the dbt project (silver + gold layers).

Wraps `dbt run` as a Python stage so the orchestrator runner can spawn it
(its subprocess runner only supports `python` / `r` languages). Exits non-zero
if any model fails, which makes the orchestrator stop downstream stages.

Environment:
  DBT_PROJECT_DIR  default <repo>/dbt
  DBT_PROFILES_DIR default <repo>/dbt
  DUCKDB_PATH      target for the warehouse file
  DBT_TARGET       default duckdb
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def ensure_profiles(profiles_dir: Path, duckdb_path: Path) -> Path:
    """Generate dbt/profiles.yml from the warehouse path if missing."""
    profiles_dir.mkdir(parents=True, exist_ok=True)
    profile = profiles_dir / "profiles.yml"
    if not profile.exists():
        profile.write_text(
            f"""air_quality:
  outputs:
    duckdb:
      type: duckdb
      path: {duckdb_path}
      threads: 4
  target: duckdb
""",
            encoding="utf-8",
        )
        print(f"[dbt] generated {profile}", flush=True)
    return profile


def main():
    project_dir = Path(os.environ.get("DBT_PROJECT_DIR", REPO_ROOT / "dbt"))
    profiles_dir = Path(os.environ.get("DBT_PROFILES_DIR", REPO_ROOT / "dbt"))
    duckdb_path = Path(os.environ.get("DUCKDB_PATH", REPO_ROOT / "data" / "air_quality.duckdb"))

    ensure_profiles(profiles_dir, duckdb_path)

    env = dict(os.environ)
    env["DBT_PROFILES_DIR"] = str(profiles_dir)

    print(f"[dbt] project-dir={project_dir} profiles-dir={profiles_dir}", flush=True)
    cmd = ["dbt", "run", "--project-dir", str(project_dir)]
    result = subprocess.run(cmd, cwd=str(project_dir), env=env, capture_output=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
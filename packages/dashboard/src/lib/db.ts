const DATABASE_URL = process.env.DATABASE_URL;

let query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;

if (DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    options: '-c search_path=pipefitter_meta',
  });

  (async () => {
    try {
      await pool.query('CREATE SCHEMA IF NOT EXISTS pipefitter_meta');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pipeline_runs (
          id            TEXT PRIMARY KEY,
          client_name   TEXT NOT NULL,
          pipeline_name TEXT NOT NULL,
          pipeline_id   TEXT,
          status        TEXT NOT NULL DEFAULT 'running',
          started_at    TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
          finished_at   TEXT,
          duration_ms   INTEGER,
          trigger_type  TEXT NOT NULL DEFAULT 'scheduled'
        );
        CREATE TABLE IF NOT EXISTS stage_runs (
          id              TEXT PRIMARY KEY,
          pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
          stage_name      TEXT NOT NULL,
          stage_order     INTEGER NOT NULL,
          attempt         INTEGER NOT NULL DEFAULT 1,
          script_path     TEXT NOT NULL,
          language        TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'running',
          started_at      TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
          finished_at     TEXT,
          duration_ms     INTEGER,
          exit_code       INTEGER,
          stdout_log      TEXT,
          stderr_log      TEXT,
          error_message   TEXT
        );
        CREATE TABLE IF NOT EXISTS pipeline_config (
          pipeline_id TEXT PRIMARY KEY,
          paused INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS viewer_tokens (
          client_name TEXT PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
          revoked INTEGER NOT NULL DEFAULT 0
        );
      `);
    } catch (err: any) {
      console.warn('[pipefitter] Postgres table init:', err.message);
    }
  })();

  query = async (sql, params) => {
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    try {
      const result = await pool.query(pgSql, params || []);
      return { rows: result.rows || [] };
    } catch (err: any) {
      console.error('[pipefitter] Postgres error:', err.message);
      return { rows: [] };
    }
  };
} else {
  let db: any = null;

  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath =
      process.env.DATABASE_PATH ||
      path.resolve(process.cwd(), '..', '..', 'pipefitter.db');
    console.log('[pipefitter] Opening database at:', dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id            TEXT PRIMARY KEY,
        client_name   TEXT NOT NULL,
        pipeline_name TEXT NOT NULL,
        pipeline_id   TEXT,
        status        TEXT NOT NULL DEFAULT 'running',
        started_at    TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at   TEXT,
        duration_ms   INTEGER,
        trigger_type  TEXT NOT NULL DEFAULT 'scheduled'
      );
      CREATE TABLE IF NOT EXISTS stage_runs (
        id              TEXT PRIMARY KEY,
        pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        stage_name      TEXT NOT NULL,
        stage_order     INTEGER NOT NULL,
        attempt         INTEGER NOT NULL DEFAULT 1,
        script_path     TEXT NOT NULL,
        language        TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'running',
        started_at      TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at     TEXT,
        duration_ms     INTEGER,
        exit_code       INTEGER,
        stdout_log      TEXT,
        stderr_log      TEXT,
        error_message   TEXT
      );
    `);

    try {
      db.exec(`ALTER TABLE pipeline_runs ADD COLUMN pipeline_id TEXT`);
    } catch {}
    try {
      db.exec(
        `CREATE TABLE IF NOT EXISTS pipeline_config (pipeline_id TEXT PRIMARY KEY, paused INTEGER NOT NULL DEFAULT 0);`
      );
    } catch {}
    try {
      db.exec(
        `CREATE TABLE IF NOT EXISTS viewer_tokens (client_name TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), revoked INTEGER NOT NULL DEFAULT 0);`
      );
    } catch {}
  } catch (e: any) {
    console.warn(
      'SQLite not available (this is normal during build):',
      e.message
    );
  }

  query = async (sql, params) => {
    if (!db) return { rows: [] };
    try {
      const stmt = db.prepare(sql);
      const type = sql.trim().toUpperCase().slice(0, 6);
      if (type === 'SELECT') {
        return { rows: stmt.all(...(params || [])) };
      }
      stmt.run(...(params || []));
      return { rows: [] };
    } catch (err: any) {
      console.error('[pipefitter] SQLite error:', err.message);
      return { rows: [] };
    }
  };
}

export interface PipelineRun {
  id: string;
  client_name: string;
  pipeline_name: string;
  pipeline_id: string | null;
  status: 'running' | 'success' | 'failed' | 'stuck';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  trigger_type: 'scheduled' | 'manual';
  failed_stages: number;
}

export interface StageRun {
  id: string;
  pipeline_run_id: string;
  stage_name: string;
  stage_order: number;
  attempt: number;
  script_path: string;
  language: 'python' | 'r';
  status: 'running' | 'success' | 'failed';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  stdout_log: string | null;
  stderr_log: string | null;
  error_message: string | null;
}

export async function getLatestPipelineRuns(): Promise<PipelineRun[]> {
  try {
    const { rows } = await query(`
      SELECT pr.id, pr.client_name, pr.pipeline_name, pr.pipeline_id, pr.status,
             pr.started_at, pr.finished_at, pr.duration_ms, pr.trigger_type,
             (SELECT COUNT(*) FROM stage_runs sr
              WHERE sr.pipeline_run_id = pr.id AND sr.status = 'failed') AS failed_stages
      FROM pipeline_runs pr
      WHERE (pr.client_name, pr.pipeline_name, pr.started_at) IN (
        SELECT pr2.client_name, pr2.pipeline_name, MAX(pr2.started_at)
        FROM pipeline_runs pr2
        GROUP BY pr2.client_name, pr2.pipeline_name
      )
      ORDER BY pr.client_name, pr.pipeline_name
    `);
    return rows as PipelineRun[];
  } catch (e: any) {
    console.error('[pipefitter] getLatestPipelineRuns error:', e.message);
    return [];
  }
}

export async function getAllRuns(
  limit = 50,
  offset = 0
): Promise<PipelineRun[]> {
  try {
    const { rows } = await query(
      `SELECT pr.id, pr.client_name, pr.pipeline_name, pr.status,
              pr.started_at, pr.finished_at, pr.duration_ms, pr.trigger_type,
              (SELECT COUNT(*) FROM stage_runs sr
               WHERE sr.pipeline_run_id = pr.id AND sr.status = 'failed') AS failed_stages
       FROM pipeline_runs pr
       ORDER BY pr.started_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows as PipelineRun[];
  } catch (e: any) {
    console.error('[pipefitter] getAllRuns error:', e.message);
    return [];
  }
}

export async function getRunDetail(
  runId: string
): Promise<{ pipelineRun: PipelineRun; stageRuns: StageRun[] } | null> {
  try {
    const { rows: pipelineRows } = await query(
      'SELECT * FROM pipeline_runs WHERE id = ?',
      [runId]
    );
    if (pipelineRows.length === 0) return null;

    const { rows: stageRows } = await query(
      'SELECT * FROM stage_runs WHERE pipeline_run_id = ? ORDER BY stage_order, attempt',
      [runId]
    );

    return {
      pipelineRun: pipelineRows[0] as PipelineRun,
      stageRuns: stageRows as StageRun[],
    };
  } catch (e: any) {
    console.error('[pipefitter] getRunDetail error:', e.message);
    return null;
  }
}

export async function resolveClientByToken(
  token: string
): Promise<string | null> {
  try {
    const { rows } = await query(
      'SELECT client_name FROM viewer_tokens WHERE token = ? AND revoked = 0',
      [token]
    );
    return rows.length > 0 ? rows[0].client_name : null;
  } catch {
    return null;
  }
}

export async function getLatestRunsByClient(
  clientName: string
): Promise<PipelineRun[]> {
  try {
    const { rows } = await query(
      `SELECT pr.id, pr.client_name, pr.pipeline_name, pr.pipeline_id, pr.status,
             pr.started_at, pr.finished_at, pr.duration_ms, pr.trigger_type,
             (SELECT COUNT(*) FROM stage_runs sr
              WHERE sr.pipeline_run_id = pr.id AND sr.status = 'failed') AS failed_stages
       FROM pipeline_runs pr
       WHERE pr.client_name = ?
       ORDER BY pr.started_at DESC LIMIT 50`,
      [clientName]
    );
    return rows as PipelineRun[];
  } catch (e: any) {
    console.error('[pipefitter] getLatestRunsByClient error:', e.message);
    return [];
  }
}

export async function getPausedPipelines(): Promise<string[]> {
  try {
    const { rows } = await query(
      'SELECT pipeline_id FROM pipeline_config WHERE paused = 1'
    );
    return rows.map((r: any) => r.pipeline_id);
  } catch {
    return [];
  }
}

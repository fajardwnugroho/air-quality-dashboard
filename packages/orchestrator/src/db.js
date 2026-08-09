const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

let query;

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
        CREATE INDEX IF NOT EXISTS idx_stage_runs_run_id ON stage_runs(pipeline_run_id);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
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
    } catch (err) {
      console.error('[pipefitter] Postgres table init:', err.message);
    }
  })();

  query = async (sql, params) => {
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    try {
      const result = await pool.query(pgSql, params || []);
      return { rows: result.rows || [], rowCount: result.rowCount };
    } catch (err) {
      console.error('Postgres error:', err.message);
      console.error('SQL:', pgSql.slice(0, 200));
      console.error('Params:', params);
      throw err;
    }
  };
} else {
  const Database = require('better-sqlite3');
  const dbPath =
    process.env.DATABASE_PATH ||
    require('path').resolve(__dirname, '..', '..', '..', 'pipefitter.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

    CREATE INDEX IF NOT EXISTS idx_stage_runs_run_id ON stage_runs(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
  `);

  try {
    db.exec(`ALTER TABLE pipeline_runs ADD COLUMN pipeline_id TEXT`);
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_config (
      pipeline_id TEXT PRIMARY KEY,
      paused INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_tokens (
      client_name TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked INTEGER NOT NULL DEFAULT 0
    );
  `);

  query = async (sql, params) => {
    const stmt = db.prepare(sql);
    try {
      const type = sql.trim().toUpperCase().slice(0, 6);
      if (type === 'SELECT') {
        return { rows: stmt.all(...(params || [])) };
      }
      if (type === 'INSERT') {
        const info = stmt.run(...(params || []));
        return { rows: [], lastInsertRowid: info.lastInsertRowid };
      }
      stmt.run(...(params || []));
      return { rows: [] };
    } catch (err) {
      console.error('SQLite error:', err.message);
      console.error('SQL:', sql.slice(0, 200));
      console.error('Params:', params);
      throw err;
    }
  };
}

async function createRun(clientName, pipelineName, triggerType, pipelineId) {
  const id = uuid();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO pipeline_runs (id, client_name, pipeline_name, pipeline_id, status, trigger_type, started_at)
     VALUES (?, ?, ?, ?, 'running', ?, ?)`,
    [id, clientName, pipelineName, pipelineId || null, triggerType, now]
  );
  const { rows } = await query('SELECT * FROM pipeline_runs WHERE id = ?', [id]);
  return rows[0];
}

async function updateRunStatus(runId, status, finishedAt, durationMs) {
  await query(
    `UPDATE pipeline_runs SET status = ?, finished_at = ?, duration_ms = ? WHERE id = ?`,
    [status, finishedAt, durationMs, runId]
  );
  const { rows } = await query('SELECT * FROM pipeline_runs WHERE id = ?', [runId]);
  return rows[0];
}

async function createStageRun(runId, stageName, stageOrder, scriptPath, language) {
  const id = uuid();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO stage_runs (id, pipeline_run_id, stage_name, stage_order, attempt, script_path, language, status, started_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, 'running', ?)`,
    [id, runId, stageName, stageOrder, scriptPath, language, now]
  );
  const { rows } = await query('SELECT * FROM stage_runs WHERE id = ?', [id]);
  return rows[0];
}

async function updateStageRun(stageRunId, fields) {
  const entries = Object.entries(fields);
  const setClauses = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, v]) => v);
  values.push(stageRunId);
  await query(
    `UPDATE stage_runs SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
  const { rows } = await query('SELECT * FROM stage_runs WHERE id = ?', [stageRunId]);
  return rows[0];
}

async function isPipelineRunning(clientName, pipelineName) {
  const { rows } = await query(
    `SELECT id FROM pipeline_runs
     WHERE client_name = ? AND pipeline_name = ? AND status = 'running'
     LIMIT 1`,
    [clientName, pipelineName]
  );
  return rows.length > 0;
}

async function getStuckRuns() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { rows } = await query(
    `SELECT * FROM pipeline_runs
     WHERE status = 'running'
       AND started_at < ?`,
    [thirtyMinutesAgo]
  );
  return rows;
}

async function listLatestRuns() {
  const { rows } = await query(`
    SELECT pr.id, pr.client_name, pr.pipeline_name, pr.status,
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
  return { rows };
}

async function listRuns(limit, offset) {
  const { rows } = await query(
    `SELECT pr.id, pr.client_name, pr.pipeline_name, pr.status,
            pr.started_at, pr.finished_at, pr.duration_ms, pr.trigger_type,
            (SELECT COUNT(*) FROM stage_runs sr
             WHERE sr.pipeline_run_id = pr.id AND sr.status = 'failed') AS failed_stages
     FROM pipeline_runs pr
     ORDER BY pr.started_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return { rows };
}

async function getOrCreateToken(clientName) {
  const { rows } = await query(
    'SELECT token FROM viewer_tokens WHERE client_name = ? AND revoked = 0',
    [clientName]
  );
  if (rows.length > 0) return rows[0].token;
  const token = uuid();
  await query(
    `INSERT INTO viewer_tokens (client_name, token, created_at, revoked) VALUES (?, ?, ?, 0)`,
    [clientName, token, new Date().toISOString()]
  );
  return token;
}

async function getClientByToken(token) {
  const { rows } = await query(
    'SELECT client_name FROM viewer_tokens WHERE token = ? AND revoked = 0',
    [token]
  );
  return rows.length > 0 ? rows[0].client_name : null;
}

async function revokeToken(clientName) {
  await query('UPDATE viewer_tokens SET revoked = 1 WHERE client_name = ?', [clientName]);
}

async function setPaused(pipelineId, paused) {
  await query(
    `INSERT INTO pipeline_config (pipeline_id, paused) VALUES (?, ?)
     ON CONFLICT(pipeline_id) DO UPDATE SET paused = ?`,
    [pipelineId, paused ? 1 : 0, paused ? 1 : 0]
  );
}

async function isPaused(pipelineId) {
  const { rows } = await query(
    'SELECT paused FROM pipeline_config WHERE pipeline_id = ?',
    [pipelineId]
  );
  return rows.length > 0 && rows[0].paused === 1;
}

async function getAllPaused() {
  const { rows } = await query('SELECT pipeline_id FROM pipeline_config WHERE paused = 1');
  return rows.map(r => r.pipeline_id);
}

module.exports = {
  query,
  createRun,
  updateRunStatus,
  createStageRun,
  updateStageRun,
  isPipelineRunning,
  getStuckRuns,
  listLatestRuns,
  listRuns,
  setPaused,
  isPaused,
  getAllPaused,
  getOrCreateToken,
  getClientByToken,
  revokeToken,
};

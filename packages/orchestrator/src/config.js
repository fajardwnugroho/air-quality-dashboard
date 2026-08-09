const path = require('path');
const fs = require('fs');

const envScriptsRoot = process.env.SCRIPTS_ROOT;
const defaultScriptsRoot =
  process.env.NODE_ENV === 'production'
    ? '/pipeline'
    : path.resolve(__dirname, '..', '..', '..', 'pipeline');

const scriptsRoot =
  envScriptsRoot && fs.existsSync(envScriptsRoot)
    ? envScriptsRoot
    : defaultScriptsRoot;

const pipelines = [
  {
    id: 'openaq-air-quality',
    clientName: 'Air Quality Dashboard',
    pipelineName: 'OpenAQ Air Quality (DuckDB medallion)',
    schedule: '*/15 * * * *',
    maxRetries: 2,
    backoffMs: 15000,
    stages: [
      { name: 'extract_bronze', script: 'openaq-air-quality/01_extract_bronze.py', language: 'python' },
      { name: 'dbt_run',        script: 'openaq-air-quality/02_dbt_run.py',        language: 'python' },
      { name: 'dbt_test',       script: 'openaq-air-quality/03_dbt_test.py',       language: 'python' },
      { name: 'sync_gold',      script: 'openaq-air-quality/04_sync_gold.py',      language: 'python' },
    ],
  },
];

function getPipeline(id) {
  return pipelines.find(p => p.id === id);
}

function getAllPipelines() {
  return pipelines;
}

function resolveScriptPath(relativePath) {
  return path.resolve(scriptsRoot, relativePath);
}

module.exports = { pipelines, getPipeline, getAllPipelines, resolveScriptPath };
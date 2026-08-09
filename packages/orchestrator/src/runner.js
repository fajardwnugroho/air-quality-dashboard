const { spawn } = require('child_process');
const path = require('path');
const db = require('./db');
const config = require('./config');
const { notifyFailure } = require('./notifier');
const { acquireRunLock } = require('./lock');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCommand(language, scriptPath) {
  if (language === 'python') {
    return { cmd: 'python3', args: [scriptPath] };
  }
  if (language === 'r') {
    return { cmd: 'Rscript', args: [scriptPath] };
  }
  throw new Error(`Unknown language: ${language}`);
}

function runScript(scriptPath, language, env) {
  return new Promise((resolve) => {
    const { cmd, args } = getCommand(language, scriptPath);
    const spawnEnv = {
      ...process.env,
      ...env,
      PATH: `${process.env.PATH || ''}:/usr/local/bin:/opt/homebrew/bin:/Library/Frameworks/Python.framework/Versions/3.13/bin`,
    };
    const child = spawn(cmd, args, {
      env: spawnEnv,
      cwd: path.dirname(scriptPath),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    child.on('error', (err) => {
      resolve({ exitCode: -1, stdout, stderr: err.message });
    });
  });
}

async function executePipeline(pipelineDef, triggerType) {
  const { id, clientName, pipelineName, maxRetries, backoffMs, stages } = pipelineDef;

  const paused = await db.isPaused(id);
  if (paused) {
    console.log(`[${id}] Skipped: pipeline is paused`);
    return { skipped: true, reason: 'Pipeline is paused' };
  }

  const canRun = await acquireRunLock(clientName, pipelineName);
  if (!canRun) {
    console.log(`[${id}] Skipped: pipeline already running`);
    return { skipped: true, reason: 'Pipeline already running' };
  }

  const pipelineRun = await db.createRun(clientName, pipelineName, triggerType, id);
  const runId = pipelineRun.id;
  console.log(`[${id}] Run ${runId} started`);

  let overallStatus = 'success';
  let failureDetails = null;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const scriptPath = config.resolveScriptPath(stage.script);
    let stageSuccess = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const stageRun = await db.createStageRun(runId, stage.name, i + 1, scriptPath, stage.language);
      const stageRunId = stageRun.id;
      const startTime = Date.now();

      console.log(`[${id}] Stage ${stage.name} attempt ${attempt}/${maxRetries} started`);

      const env = {
        CLIENT_DB_URL: process.env[`CLIENT_DB_URL_${id.toUpperCase().replace(/-/g, '_')}`] || '',
        SCRIPTS_ROOT: require('path').resolve(__dirname, '..', '..', '..', 'pipeline'),
        PIPELINE_RUN_ID: runId,
        STAGE_NAME: stage.name,
      };

      const { exitCode, stdout, stderr } = await runScript(scriptPath, stage.language, env);
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      const updateFields = {
        finished_at: finishedAt,
        duration_ms: durationMs,
        exit_code: exitCode,
        stdout_log: stdout,
        stderr_log: stderr,
      };

      if (exitCode === 0) {
        updateFields.status = 'success';
        await db.updateStageRun(stageRunId, updateFields);
        console.log(`[${id}] Stage ${stage.name} attempt ${attempt} succeeded`);
        stageSuccess = true;
        break;
      } else {
        const errorMessage = stderr.slice(0, 2000) || `Exit code ${exitCode}`;
        updateFields.status = 'failed';
        updateFields.error_message = errorMessage;
        await db.updateStageRun(stageRunId, updateFields);
        console.log(`[${id}] Stage ${stage.name} attempt ${attempt} failed: ${errorMessage.slice(0, 200)}`);

        if (attempt < maxRetries) {
          const backoff = backoffMs * Math.pow(2, attempt - 1);
          console.log(`[${id}] Retrying stage ${stage.name} in ${backoff}ms...`);
          await notifyFailure({
            clientName, pipelineName, stageName: stage.name,
            attempt, maxRetries, errorMessage, runId,
          });
          await sleep(backoff);
        } else {
          failureDetails = { stageName: stage.name, attempt, maxRetries, errorMessage };
        }
      }
    }

    if (!stageSuccess) {
      overallStatus = 'failed';
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(pipelineRun.started_at).getTime();
  await db.updateRunStatus(runId, overallStatus, finishedAt, durationMs);

  if (overallStatus === 'failed' && failureDetails) {
    await notifyFailure({
      clientName,
      pipelineName,
      stageName: failureDetails.stageName,
      attempt: failureDetails.attempt,
      maxRetries: failureDetails.maxRetries,
      errorMessage: failureDetails.errorMessage,
      runId,
    });
  }

  console.log(`[${id}] Run ${runId} finished: ${overallStatus} (${durationMs}ms)`);
  return { runId, status: overallStatus };
}

module.exports = { executePipeline };

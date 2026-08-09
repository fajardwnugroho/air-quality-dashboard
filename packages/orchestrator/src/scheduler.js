const cron = require('node-cron');
const config = require('./config');
const { executePipeline } = require('./runner');
const db = require('./db');

const scheduledTasks = new Map();

function startScheduler() {
  const pipelines = config.getAllPipelines();

  for (const pipeline of pipelines) {
    if (!pipeline.schedule) {
      console.log(`[scheduler] No schedule for ${pipeline.id}, skipping`);
      continue;
    }

    if (!cron.validate(pipeline.schedule)) {
      console.error(`[scheduler] Invalid cron expression for ${pipeline.id}: ${pipeline.schedule}`);
      continue;
    }

    const task = cron.schedule(pipeline.schedule, async () => {
      const paused = await db.isPaused(pipeline.id);
      if (paused) {
        console.log(`[scheduler] ${pipeline.id} is paused, skipping scheduled trigger`);
        return;
      }
      console.log(`[scheduler] Triggering ${pipeline.id} (scheduled)`);
      executePipeline(pipeline, 'scheduled').catch(err => {
        console.error(`[scheduler] Error executing ${pipeline.id}:`, err.message);
      });
    });

    scheduledTasks.set(pipeline.id, task);
    console.log(`[scheduler] Scheduled ${pipeline.id}: ${pipeline.schedule}`);
  }

  cron.schedule('*/5 * * * *', async () => {
    try {
      const stuckRuns = await db.getStuckRuns();
      for (const run of stuckRuns) {
        const avgDuration = run.avg_stage_duration || 600000;
        const threshold = avgDuration * 3;
        const elapsed = Date.now() - new Date(run.started_at).getTime();

        if (elapsed > threshold && elapsed > 300000) {
          console.log(`[stuck] Marking run ${run.id} as stuck (${Math.round(elapsed / 1000)}s elapsed, threshold ${Math.round(threshold / 1000)}s)`);
          await db.updateRunStatus(run.id, 'stuck', new Date().toISOString(), elapsed);
        }
      }
    } catch (err) {
      console.error('[stuck] Error checking stuck runs:', err.message);
    }
  });

  console.log('[scheduler] Started');
}

async function pausePipeline(pipelineId) {
  const task = scheduledTasks.get(pipelineId);
  if (task) {
    task.stop();
    console.log(`[scheduler] Paused ${pipelineId}`);
  }
  await db.setPaused(pipelineId, true);
}

async function resumePipeline(pipelineId) {
  const task = scheduledTasks.get(pipelineId);
  if (task) {
    task.start();
    console.log(`[scheduler] Resumed ${pipelineId}`);
  }
  await db.setPaused(pipelineId, false);
}

async function restorePausedStates() {
  const pausedIds = await db.getAllPaused();
  for (const id of pausedIds) {
    const task = scheduledTasks.get(id);
    if (task) {
      task.stop();
      console.log(`[scheduler] Restored paused state for ${id}`);
    }
  }
}

module.exports = { startScheduler, pausePipeline, resumePipeline, restorePausedStates };

const db = require('./db');

async function acquireRunLock(clientName, pipelineName) {
  const running = await db.isPipelineRunning(clientName, pipelineName);
  if (running) {
    return false;
  }
  return true;
}

module.exports = { acquireRunLock };

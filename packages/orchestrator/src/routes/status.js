const { Router } = require('express');
const db = require('../db');
const config = require('../config');

const router = Router();

router.get('/pipelines', async (req, res) => {
  try {
    const result = await db.listLatestRuns();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:runId', async (req, res) => {
  try {
    const { rows: [pipelineRun] } = await db.query(
      'SELECT * FROM pipeline_runs WHERE id = ?',
      [req.params.runId]
    );
    if (!pipelineRun) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const { rows: stageRuns } = await db.query(
      'SELECT * FROM stage_runs WHERE pipeline_run_id = ? ORDER BY stage_order, attempt',
      [req.params.runId]
    );

    res.json({ pipelineRun, stageRuns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.listRuns(limit, offset);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pipelines/definitions', (req, res) => {
  res.json(config.getAllPipelines());
});

module.exports = router;

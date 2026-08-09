const { Router } = require('express');
const config = require('../config');
const db = require('../db');
const scheduler = require('../scheduler');

const router = Router();

router.post('/pipelines/:pipelineId/pause', async (req, res) => {
  const pipeline = config.getPipeline(req.params.pipelineId);
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
  await scheduler.pausePipeline(req.params.pipelineId);
  res.json({ paused: true, pipelineId: req.params.pipelineId });
});

router.post('/pipelines/:pipelineId/resume', async (req, res) => {
  const pipeline = config.getPipeline(req.params.pipelineId);
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
  await scheduler.resumePipeline(req.params.pipelineId);
  res.json({ paused: false, pipelineId: req.params.pipelineId });
});

router.get('/pipelines/status', async (req, res) => {
  const pipelines = config.getAllPipelines();
  const pausedIds = await db.getAllPaused();
  const result = pipelines.map(p => ({
    id: p.id,
    clientName: p.clientName,
    pipelineName: p.pipelineName,
    schedule: p.schedule,
    paused: pausedIds.includes(p.id),
  }));
  res.json(result);
});

module.exports = router;

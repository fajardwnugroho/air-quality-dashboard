require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { startScheduler } = require('./scheduler');
const triggersRouter = require('./routes/triggers');
const statusRouter = require('./routes/status');
const pipelinesRouter = require('./routes/pipelines');
const tokensRouter = require('./routes/tokens');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.all('/', (req, res) => {
  if (req.method === 'POST') {
    return res.status(400).json({
      error: 'Use POST /api/run/:pipelineId instead (e.g. POST /api/run/openaq-air-quality)',
      available: ['openaq-air-quality'],
    });
  }
  res.json({
    name: 'Pipefitter Orchestrator',
    endpoints: {
      trigger: 'POST /api/run/:pipelineId',
      pipelines: 'GET /api/pipelines',
      runDetail: 'GET /api/runs/:runId',
      runs: 'GET /api/runs',
      definitions: 'GET /api/pipelines/definitions',
      health: 'GET /health',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', triggersRouter);
app.use('/api', statusRouter);
app.use('/api', pipelinesRouter);
app.use('/api', tokensRouter);

startScheduler();

const { restorePausedStates } = require('./scheduler');
restorePausedStates();

app.listen(PORT, () => {
  console.log(`Pipefitter orchestrator running on port ${PORT}`);
});

const { Router } = require('express');
const config = require('../config');
const { executePipeline } = require('../runner');

const router = Router();

router.post('/run/:pipelineId', async (req, res) => {
  const pipeline = config.getPipeline(req.params.pipelineId);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  try {
    const result = await executePipeline(pipeline, 'manual');

    if (result.skipped) {
      return res.status(409).json({ error: result.reason });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

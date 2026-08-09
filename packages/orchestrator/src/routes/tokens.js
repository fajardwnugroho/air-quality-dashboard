const { Router } = require('express');
const db = require('../db');

const router = Router();

router.post('/tokens', async (req, res) => {
  const { clientName } = req.body;
  if (!clientName) return res.status(400).json({ error: 'clientName is required' });
  const token = await db.getOrCreateToken(clientName);
  res.json({ token, clientName });
});

router.get('/tokens/resolve', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token is required' });
  const clientName = await db.getClientByToken(token);
  if (!clientName) return res.status(404).json({ error: 'Token not found or revoked' });
  res.json({ clientName });
});

router.delete('/tokens/:clientName', async (req, res) => {
  await db.revokeToken(req.params.clientName);
  res.json({ revoked: true, clientName: req.params.clientName });
});

module.exports = router;

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function notifyFailure({ clientName, pipelineName, stageName, attempt, maxRetries, errorMessage, runId }) {
  const text = [
    `🚨 *Pipefitter: Pipeline Failed*`,
    `*Client:* ${clientName}`,
    `*Pipeline:* ${pipelineName}`,
    `*Stage:* ${stageName} (attempt ${attempt}/${maxRetries})`,
    `*Run ID:* ${runId}`,
    `*Error:* ${errorMessage ? errorMessage.slice(0, 500) : 'Unknown error'}`,
  ].join('\n');

  if (!SLACK_WEBHOOK_URL) {
    console.log('SLACK_WEBHOOK_URL not set. Would have sent:\n' + text);
    return;
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error('Slack notification failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Slack notification error:', err.message);
  }
}

module.exports = { notifyFailure };

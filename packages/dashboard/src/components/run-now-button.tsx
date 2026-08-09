'use client';

import { useState } from 'react';

export function RunNowButton({ pipelineId, redirectTo }: { pipelineId: string; redirectTo?: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRun() {
    setLoading(true);
    try {
      await fetch(`http://localhost:3001/api/run/${pipelineId}`, {
        method: 'POST',
      });
    } catch {
      // ignore
    }
    setDone(true);
    if (redirectTo) {
      window.location.href = redirectTo;
    } else {
      window.location.reload();
    }
  }

  if (done) return null;

  return (
    <button
      onClick={handleRun}
      disabled={loading}
      className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? 'Running...' : 'Run Now'}
    </button>
  );
}

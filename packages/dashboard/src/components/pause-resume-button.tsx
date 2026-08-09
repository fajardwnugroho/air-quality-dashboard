'use client';

import { useState } from 'react';

export function PauseResumeButton({ pipelineId, paused: initial }: { pipelineId: string; paused: boolean }) {
  const [paused, setPaused] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const endpoint = paused ? 'resume' : 'pause';
      await fetch(`http://localhost:3001/api/pipelines/${pipelineId}/${endpoint}`, {
        method: 'POST',
      });
      setPaused(!paused);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`h-7 rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
        paused
          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
          : 'bg-amber-500 text-white hover:bg-amber-400'
      }`}
    >
      {loading ? '...' : paused ? 'Resume' : 'Pause'}
    </button>
  );
}

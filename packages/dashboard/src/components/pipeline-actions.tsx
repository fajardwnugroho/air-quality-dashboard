'use client';

import Link from 'next/link';
import { RunNowButton } from '@/components/run-now-button';
import { PauseResumeButton } from '@/components/pause-resume-button';

export function PipelineActions({
  pipelineId,
  paused,
  runId,
}: {
  pipelineId: string;
  paused: boolean;
  runId: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {pipelineId && (
        <>
          <PauseResumeButton pipelineId={pipelineId} paused={paused} />
          <RunNowButton pipelineId={pipelineId} />
        </>
      )}
      <Link
        href={`/runs/${runId}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        View →
      </Link>
    </div>
  );
}

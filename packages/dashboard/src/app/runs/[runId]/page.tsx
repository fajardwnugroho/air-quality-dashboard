export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { TimeDisplay } from '@/components/time-display';
import { RunNowButton } from '@/components/run-now-button';
import { StageLog } from '@/components/stage-log';
import { PipelineFlow } from '@/components/pipeline-flow';
import { getRunDetail } from '@/lib/db';

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const data = await getRunDetail(runId);

  if (!data) {
    notFound();
  }

  const { pipelineRun: run, stageRuns } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Dashboard
        </Link>
      </nav>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{run.pipeline_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{run.client_name}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={run.status} />
              {run.pipeline_id && (
                <RunNowButton pipelineId={run.pipeline_id} redirectTo="/" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Run ID</span>
              <p className="font-mono text-xs">{run.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Run</span>
              <p><TimeDisplay iso={run.started_at} /></p>
            </div>
            <div>
              <span className="text-muted-foreground">Finished</span>
              <p><TimeDisplay iso={run.finished_at} /></p>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <p className="font-mono">{formatDuration(run.duration_ms)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Trigger</span>
              <p className="capitalize">{run.trigger_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stages</span>
              <p>{new Set(stageRuns.map(s => s.stage_name)).size}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PipelineFlow stageRuns={stageRuns} />

      <h2 className="mb-4 text-lg font-semibold">Stage Details</h2>
      <StageLog stageRuns={stageRuns} />
    </div>
  );
}

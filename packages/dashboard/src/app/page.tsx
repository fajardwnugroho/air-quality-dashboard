export const dynamic = 'force-dynamic';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { TimeDisplay } from '@/components/time-display';
import { PipelineActions } from '@/components/pipeline-actions';
import { ShareButton } from '@/components/share-button';
import { getLatestPipelineRuns, getPausedPipelines } from '@/lib/db';

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default async function DashboardPage() {
  const pipelines = await getLatestPipelineRuns();
  const pausedPipelines = await getPausedPipelines();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Latest run per pipeline</p>
      </header>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Failed Stages</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pipelines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No pipeline runs yet. Trigger one from the orchestrator API.
                </TableCell>
              </TableRow>
            ) : (
              pipelines.map((p) => (
                <TableRow key={`${p.client_name}-${p.pipeline_name}`}>
                  <TableCell className="font-medium">{p.client_name}</TableCell>
                  <TableCell>{p.pipeline_name}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeDisplay iso={p.started_at} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDuration(p.duration_ms)}
                  </TableCell>
                  <TableCell>{p.failed_stages}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.trigger_type}
                  </TableCell>
                  <TableCell>
                    <PipelineActions
                      pipelineId={p.pipeline_id || ''}
                      paused={pausedPipelines.includes(p.pipeline_id || '')}
                      runId={p.id}
                    />
                  </TableCell>
                  <TableCell>
                    <ShareButton clientName={p.client_name} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

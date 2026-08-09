'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatusBadge } from '@/components/status-badge';
import { TimeDisplay } from '@/components/time-display';
import { LanguageBadge } from '@/components/language-badge';
import type { StageRun } from '@/lib/db';

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function StageLog({ stageRuns }: { stageRuns: StageRun[] }) {
  const attemptsByStage = stageRuns.reduce<Record<string, StageRun[]>>((acc, sr) => {
    const key = `${sr.stage_order}-${sr.stage_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sr);
    return acc;
  }, {} as Record<string, StageRun[]>);

  return (
    <div className="space-y-4">
      {Object.entries(attemptsByStage).map(([key, attempts]) => {
        const [stageOrder, stageName] = key.split('-');
        const lastAttempt = attempts[attempts.length - 1];

        return (
          <Collapsible key={key}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  {stageOrder}.
                </span>
                <span className="font-medium">{stageName}</span>
                <LanguageBadge language={lastAttempt.language as 'python' | 'r'} />
                <StatusBadge status={lastAttempt.status as 'running' | 'success' | 'failed' | 'stuck'} />
                {attempts.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ({attempts.length} attempts)
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDuration(lastAttempt.duration_ms)}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3 pl-6">
              {attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      Attempt {attempt.attempt}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDuration(attempt.duration_ms)}
                    </span>
                  </div>

                  <div className="mb-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Started: <TimeDisplay iso={attempt.started_at} /></span>
                    <span>Finished: <TimeDisplay iso={attempt.finished_at} /></span>
                    <span>Exit code: {attempt.exit_code ?? '—'}</span>
                    <span>Script: {attempt.script_path}</span>
                  </div>

                  {attempt.stderr_log && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-red-500">stderr:</span>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs text-red-400">
                        {attempt.stderr_log}
                      </pre>
                    </div>
                  )}

                  {attempt.stdout_log && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-muted-foreground">stdout:</span>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                        {attempt.stdout_log}
                      </pre>
                    </div>
                  )}

                  {attempt.error_message && (
                    <div className="mt-2 text-xs text-red-500">
                      Error: {attempt.error_message}
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

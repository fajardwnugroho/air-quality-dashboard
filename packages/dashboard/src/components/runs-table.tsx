'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { TimeDisplay } from '@/components/time-display';
import { RunNowButton } from '@/components/run-now-button';
import type { PipelineRun } from '@/lib/db';

const PAGE_SIZE = 50;

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function RunsTable({ runs }: { runs: PipelineRun[] }) {
  const [clientFilter, setClientFilter] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => runs.filter((r) => {
    const matchClient = !clientFilter || r.client_name.toLowerCase().includes(clientFilter.toLowerCase());
    const matchPipeline = !pipelineFilter || r.pipeline_name.toLowerCase().includes(pipelineFilter.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchDate = !dateFilter || r.started_at >= dateFilter;
    return matchClient && matchPipeline && matchStatus && matchDate;
  }), [runs, clientFilter, pipelineFilter, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageEnd);

  function goToPage(p: number) {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
  }

  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > 3) pageNumbers.push('ellipsis');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (safePage < totalPages - 2) pageNumbers.push('ellipsis');
    pageNumbers.push(totalPages);
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background pb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Client</label>
            <input
              type="text"
              placeholder="Filter by client..."
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setCurrentPage(1); }}
              className="h-8 w-44 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Pipeline</label>
            <input
              type="text"
              placeholder="Filter by pipeline..."
              value={pipelineFilter}
              onChange={(e) => { setPipelineFilter(e.target.value); setCurrentPage(1); }}
              className="h-8 w-44 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="stuck">Stuck</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">From Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
              className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Finished</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Failed Stages</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  {runs.length === 0
                    ? 'No pipeline runs yet.'
                    : 'No runs match your filters.'}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.client_name}</TableCell>
                  <TableCell>{r.pipeline_name}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeDisplay iso={r.started_at} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeDisplay iso={r.finished_at} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDuration(r.duration_ms)}
                  </TableCell>
                  <TableCell>{r.failed_stages}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.trigger_type}
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    {r.pipeline_id && (
                      <RunNowButton pipelineId={r.pipeline_id} />
                    )}
                    <Link
                      href={`/runs/${r.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View →
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filtered.length === 0 ? 0 : pageStart + 1}&ndash;{Math.min(pageEnd, filtered.length)} of {filtered.length} runs
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
            className="h-7 rounded border bg-background px-2 text-xs font-medium hover:bg-muted disabled:opacity-30"
          >
            ← Prev
          </button>

          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} className="px-1 text-xs">...</span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`h-7 min-w-7 rounded border px-2 text-xs font-medium ${
                  p === safePage
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="h-7 rounded border bg-background px-2 text-xs font-medium hover:bg-muted disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { Mermaid } from '@/components/mermaid';
import type { StageRun } from '@/lib/db';

const STATUS_COLORS: Record<string, string> = {
  success: '#4ade80',
  failed: '#f87171',
  running: '#fbbf24',
  stuck: '#a78bfa',
};

const LAYER_COLORS: Record<string, string> = {
  bronze: '#d97706',
  silver: '#6b7280',
  gold: '#ca8a04',
};

function getLayer(name: string): string | null {
  for (const key of Object.keys(LAYER_COLORS)) {
    if (name.startsWith(key)) return key;
  }
  return null;
}

function nodeId(index: number): string {
  return `s${index}`;
}

function escapeLabel(text: string): string {
  return text.replace(/[<>"]/g, '').replace(/[\[\]]/g, '');
}

export function PipelineFlow({ stageRuns }: { stageRuns: StageRun[] }) {
  const chart = useMemo(() => {
    // Group by (stage_order, stage_name), take last attempt's status
    const stageMap = new Map<string, { order: number; name: string; status: string }>();
    for (const s of stageRuns) {
      stageMap.set(`${s.stage_order}-${s.stage_name}`, {
        order: s.stage_order,
        name: s.stage_name,
        status: s.status,
      });
    }

    const stages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
    if (stages.length === 0) return '';

    const lines: string[] = ['graph LR'];

    // Build subgraphs by layer
    const layerMap = new Map<string, typeof stages>();
    for (const s of stages) {
      const layer = getLayer(s.name) || '_ungrouped';
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push(s);
    }

    let idx = 0;
    const nodeIds: string[] = [];

    for (const [layer, layerStages] of layerMap.entries()) {
      if (layer !== '_ungrouped') {
        const layerLabel = layer.charAt(0).toUpperCase() + layer.slice(1);
        lines.push(`  subgraph ${layerLabel}[${layerLabel}]`);
      }

      for (const s of layerStages) {
        const id = nodeId(idx);
        nodeIds.push(id);
        const label = escapeLabel(s.name);
        const color = STATUS_COLORS[s.status] || '#94a3b8';
        lines.push(`    ${id}["${label}"]`);
        lines.push(`    style ${id} fill:${color},stroke:#333,stroke-width:2px`);
        idx++;
      }

      if (layer !== '_ungrouped') {
        lines.push('  end');
      }
    }

    // Connect stages in order
    for (let i = 0; i < nodeIds.length - 1; i++) {
      lines.push(`  ${nodeIds[i]} --> ${nodeIds[i + 1]}`);
    }

    return lines.join('\n');
  }, [stageRuns]);

  if (!chart) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">Pipeline Flow</h2>
      <div className="rounded-lg border bg-card p-4">
        <Mermaid chart={chart} />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: mermaid } = await import('mermaid');
      if (cancelled || !ref.current) return;
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      ref.current.innerHTML = chart;
      await mermaid.run({ nodes: [ref.current] });
    })();
    return () => { cancelled = true; };
  }, [chart]);

  return (
    <div className="flex justify-center overflow-x-auto py-4">
      <div ref={ref} className="mermaid">{chart}</div>
    </div>
  );
}

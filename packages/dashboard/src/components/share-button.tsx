'use client';

import { useState } from 'react';

const VIEWER_URL = process.env.NEXT_PUBLIC_VIEWER_URL || 'http://localhost:3002';

export function ShareButton({ clientName }: { clientName: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:3001/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Server returned ${res.status}`);
      }

      const data = await res.json();
      const url = `${VIEWER_URL}/view/${data.token}`;

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        window.prompt('Copy this link to share with your client:', url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        disabled={loading}
        className="h-7 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        {loading ? '...' : copied ? 'Copied!' : 'Share'}
      </button>

      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { RunsTable } from '@/components/runs-table';
import { getAllRuns } from '@/lib/db';

export default async function AllRunsPage() {
  const runs = await getAllRuns(500);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Dashboard
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">All Runs</h1>
        <p className="text-sm text-muted-foreground">
          Chronological history of all pipeline executions
        </p>
      </header>

      <RunsTable runs={runs} />
    </div>
  );
}

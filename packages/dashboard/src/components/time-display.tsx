'use client';

import { useTimezone } from '@/components/timezone-context';
import { formatInTimezone } from '@/lib/timezone';

export function TimeDisplay({ iso }: { iso: string | null }) {
  const { timezone } = useTimezone();
  return <>{formatInTimezone(iso, timezone)}</>;
}

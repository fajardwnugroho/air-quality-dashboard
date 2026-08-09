import { Badge } from '@/components/ui/badge';

type Status = 'running' | 'success' | 'failed' | 'stuck';

const variants: Record<Status, { label: string; className: string }> = {
  running: {
    label: 'Running',
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  success: {
    label: 'Success',
    className: 'bg-emerald-500 hover:bg-emerald-500 text-white',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500 hover:bg-red-500 text-white',
  },
  stuck: {
    label: 'Stuck',
    className: 'bg-red-800 hover:bg-red-800 text-white',
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const v = variants[status] || { label: status, className: 'bg-gray-500 text-white' };
  return <Badge className={v.className}>{v.label}</Badge>;
}

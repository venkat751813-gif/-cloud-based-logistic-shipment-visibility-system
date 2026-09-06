export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Number(kg).toLocaleString()} kg`;
}

export const STATUS_STYLES: Record<string, string> = {
  Booked: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'In Transit': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'At Port': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Customs Hold': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Out for Delivery': 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  Delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Delayed: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Exception: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export function statusStyle(status: string): string {
  return STATUS_STYLES[status] || 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

export const STATUS_DOT: Record<string, string> = {
  Booked: 'bg-sky-400',
  'In Transit': 'bg-cyan-400',
  'At Port': 'bg-violet-400',
  'Customs Hold': 'bg-amber-400',
  'Out for Delivery': 'bg-teal-400',
  Delivered: 'bg-emerald-400',
  Delayed: 'bg-orange-400',
  Exception: 'bg-rose-400',
};

export const PIPELINE = ['Booked', 'In Transit', 'At Port', 'Out for Delivery', 'Delivered'];

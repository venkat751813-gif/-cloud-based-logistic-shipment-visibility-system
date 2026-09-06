import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert, CheckCircle2, Clock3, Ban } from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import type { DashboardData, Shipment } from '../lib/types';
import { Card, StatusBadge, Spinner, ErrorBanner, EmptyState } from '../components/ui';
import { formatDate, daysUntil } from '../lib/format';

export default function Exceptions() {
  const [ships, setShips] = useState<Shipment[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, d] = await Promise.all([apiGet<Shipment[]>('/api/shipments'), apiGet<DashboardData>('/api/dashboard')]);
      setShips(s); setDash(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('tower:refresh', h);
    return () => window.removeEventListener('tower:refresh', h);
  }, [load]);

  const resolve = async (s: Shipment) => {
    setBusyId(s.id);
    try {
      await apiSend('/api/tracking-events', 'POST', {
        shipment_id: s.id,
        location: s.current_location,
        status: 'In Transit',
        description: 'Exception cleared by operations. Shipment back in transit.',
        sync_status: true,
      });
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusyId(null); }
  };

  if (loading) return <Spinner label="Scanning for exceptions..." />;
  if (error && !dash) return <ErrorBanner message={error} onRetry={load} />;

  const flagged = ships.filter((s) =>
    ['Delayed', 'Exception', 'Customs Hold'].includes(s.status) ||
    (dash?.overdue_ids.includes(s.id)) ||
    (dash?.at_risk_ids.includes(s.id))
  );
  const hard = flagged.filter((s) => ['Delayed', 'Exception', 'Customs Hold'].includes(s.status));
  const soft = flagged.filter((s) => !['Delayed', 'Exception', 'Customs Hold'].includes(s.status));

  const reason = (s: Shipment) => {
    if (['Delayed', 'Exception', 'Customs Hold'].includes(s.status)) return s.latest_event?.description || `Status: ${s.status}`;
    const d = daysUntil(s.eta);
    if (d !== null && d < 0) return `ETA breached ${Math.abs(d)} day(s) ago — no delivery scan yet.`;
    return `ETA in ${d} day(s) with ${100 - s.progress_pct}% of journey remaining.`;
  };

  const Row = ({ s }: { s: Shipment }) => (
    <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/shipments/${s.id}`} className="font-mono text-sm font-bold text-cyan-300 hover:underline">{s.tracking_number}</Link>
          <StatusBadge status={s.status} size="xs" />
        </div>
        <p className="mt-1 text-xs text-slate-400">{s.origin?.code} → {s.destination?.code} · {s.carrier?.name} · ETA {formatDate(s.eta)}</p>
        <p className="mt-1 text-xs text-amber-200/90">{reason(s)}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {['Delayed', 'Exception', 'Customs Hold'].includes(s.status) ? (
          <button onClick={() => resolve(s)} disabled={busyId === s.id} className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">
            <CheckCircle2 className="h-3.5 w-3.5" /> {busyId === s.id ? 'Working...' : 'Mark resolved'}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300">
            <Clock3 className="h-3.5 w-3.5" /> Watchlist
          </span>
        )}
        <Link to={`/shipments/${s.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10">Investigate</Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Exception Center</h1>
        <p className="mt-1 text-sm text-slate-400">{hard.length} active exceptions · {soft.length} shipments on watchlist</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
          <TriangleAlert className="h-5 w-5 text-rose-400" /> Active exceptions
        </div>
        {hard.length === 0
          ? <EmptyState title="No active exceptions" subtitle="Delayed, held or disrupted shipments will appear here automatically." />
          : <div className="flex flex-col gap-3">{hard.map((s) => <Row key={s.id} s={s} />)}</div>}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-white">
          <Clock3 className="h-5 w-5 text-amber-400" /> Watchlist — overdue and at-risk
        </div>
        {soft.length === 0
          ? <div className="flex items-center gap-2 text-sm text-slate-500"><Ban className="h-4 w-4" /> Nothing at risk. All ETAs look achievable.</div>
          : <div className="flex flex-col gap-3">{soft.map((s) => <Row key={s.id} s={s} />)}</div>}
      </Card>
    </div>
  );
}

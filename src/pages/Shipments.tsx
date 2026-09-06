import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Trash2, Eye, Ship, Plane, Truck, TrainFront } from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import type { Shipment } from '../lib/types';
import { MODES, STATUSES } from '../lib/types';
import { Card, StatusBadge, ProgressBar, Spinner, ErrorBanner, EmptyState } from '../components/ui';
import { formatDate } from '../lib/format';

const MODE_ICONS: Record<string, typeof Ship> = { Ocean: Ship, Air: Plane, Road: Truck, Rail: TrainFront };

export default function Shipments() {
  const [params, setParams] = useSearchParams();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const search = params.get('q') || '';
  const status = params.get('status') || '';
  const mode = params.get('mode') || '';

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await apiGet<Shipment[]>('/api/shipments');
      setShipments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shipments');
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

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return shipments.filter((s) => {
      if (status && s.status !== status) return false;
      if (mode && s.mode !== mode) return false;
      if (q && !`${s.tracking_number} ${s.consignee} ${s.goods_description} ${s.customer_name} ${s.current_location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [shipments, search, status, mode]);

  const remove = async (id: number) => {
    if (!confirm('Delete this shipment and all its tracking history?')) return;
    setDeleting(id);
    try {
      await apiSend('/api/shipments', 'DELETE', { id });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <Spinner label="Loading shipments..." />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Shipments</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} of {shipments.length} shipments</p>
        </div>
        <Link to="/new" className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-110">
          <Plus className="h-4 w-4" /> New shipment
        </Link>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search tracking #, consignee, goods, location..."
              className="w-full rounded-xl border border-white/10 bg-slate-800/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
          <select value={status} onChange={(e) => set('status', e.target.value)} className="rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white outline-none">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={mode} onChange={(e) => set('mode', e.target.value)} className="rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white outline-none">
            <option value="">All modes</option>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="No shipments found" subtitle="Try clearing filters, or create a new shipment to start tracking." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((s) => {
            const Icon = MODE_ICONS[s.mode] || Ship;
            return (
              <Card key={s.id} className="group p-5 transition hover:border-cyan-400/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-mono text-sm font-bold text-white">{s.tracking_number}</div>
                      <div className="text-[11px] text-slate-500">{s.mode} · {s.priority}</div>
                    </div>
                  </div>
                  <StatusBadge status={s.status} size="xs" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="font-bold text-white">{s.origin?.code || '—'}</span>
                  <span className="relative h-px flex-1 bg-white/15">
                    <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-400" />
                    <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-pink-400" />
                  </span>
                  <span className="font-bold text-white">{s.destination?.code || '—'}</span>
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {s.origin?.city} → {s.destination?.city} · {s.carrier?.name}
                </div>
                <div className="mt-1 truncate text-xs text-slate-500">{s.goods_description} · {s.consignee}</div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={s.progress_pct} className="flex-1" />
                  <span className="text-xs font-bold text-cyan-300">{s.progress_pct}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-slate-500">
                  <span>ETA <span className="font-semibold text-slate-300">{formatDate(s.eta)}</span></span>
                  <span>{s.event_count || 0} events</span>
                  <div className="flex items-center gap-1">
                    <Link to={`/shipments/${s.id}`} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-cyan-300 hover:bg-cyan-500/10">
                      <Eye className="h-3.5 w-3.5" /> Track
                    </Link>
                    <button onClick={() => remove(s.id)} disabled={deleting === s.id} className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

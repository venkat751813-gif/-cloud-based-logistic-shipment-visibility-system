import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Truck, CheckCircle2, TriangleAlert, Clock3,
  ArrowRight, Ship, Plane, TrainFront, Container,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import type { DashboardData, Shipment } from '../lib/types';
import { Card, CardHeader, StatusBadge, ProgressBar, Spinner, ErrorBanner } from '../components/ui';
import RouteMap from '../components/RouteMap';
import { BarChart, DonutChart } from '../components/Charts';
import { formatDate, timeAgo, PIPELINE } from '../lib/format';

const MODE_ICONS: Record<string, typeof Ship> = { Ocean: Ship, Air: Plane, Road: Truck, Rail: TrainFront };
const MODE_COLORS: Record<string, string> = { Ocean: '#38bdf8', Air: '#a78bfa', Road: '#34d399', Rail: '#fbbf24' };

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Package; label: string; value: string | number; sub: string; accent: string }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={`absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl ${accent}`} />
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-4 w-4 text-cyan-400" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{sub}</div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [dash, ships] = await Promise.all([
        apiGet<DashboardData>('/api/dashboard'),
        apiGet<Shipment[]>('/api/shipments?limit=60'),
      ]);
      setData(dash);
      setShipments(ships);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('tower:refresh', h);
    const t = setInterval(load, 30000);
    return () => { window.removeEventListener('tower:refresh', h); clearInterval(t); };
  }, [load]);

  if (loading) return <Spinner label="Connecting to visibility cloud..." />;
  if (error && !data) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <Spinner />;

  const k = data.kpis;
  const activeRoutes = shipments
    .filter((s) => s.status !== 'Delivered' && s.origin && s.destination)
    .slice(0, 12)
    .map((s, i) => ({
      origin: { lat: Number(s.origin!.lat), lng: Number(s.origin!.lng) },
      destination: { lat: Number(s.destination!.lat), lng: Number(s.destination!.lng) },
      progress: s.progress_pct,
      dim: i > 2,
    }));
  const priority = [...shipments]
    .filter((s) => s.status !== 'Delivered')
    .sort((a, b) => (data.overdue_ids.includes(a.id) ? -1 : 0) - (data.overdue_ids.includes(b.id) ? -1 : 0))
    .slice(0, 5);
  const donut = Object.entries(data.status_dist).map(([label, value]) => ({
    label,
    value,
    color: label === 'Delivered' ? '#34d399' : label === 'In Transit' ? '#22d3ee' : label === 'Booked' ? '#38bdf8' : label === 'Delayed' ? '#fb923c' : label === 'Exception' ? '#fb7185' : label === 'Customs Hold' ? '#fbbf24' : '#a78bfa',
  }));
  const activity = data.activity_per_day.map((d) => ({
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' }),
    value: d.count,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Command Center</h1>
          <p className="mt-1 text-sm text-slate-400">Live visibility across your global freight network · Sun, Sep 6 2026</p>
        </div>
        <Link to="/shipments" className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10">
          All shipments <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><Kpi icon={Package} label="Active" value={k.active} sub={`${k.in_transit} moving now`} accent="bg-cyan-500/20" /></motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}><Kpi icon={CheckCircle2} label="On-time" value={`${k.on_time_pct}%`} sub={`${k.delivered} delivered`} accent="bg-emerald-500/20" /></motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}><Kpi icon={TriangleAlert} label="Exceptions" value={k.exceptions} sub={`${k.overdue} overdue ETA`} accent="bg-rose-500/20" /></motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}><Kpi icon={Clock3} label="At risk" value={k.at_risk} sub="ETA within 3 days" accent="bg-amber-500/20" /></motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-2 xl:col-span-1"><Kpi icon={Container} label="Freight spend" value={`$${(k.total_cost_usd / 1000).toFixed(0)}k`} sub={`${(k.total_weight_kg / 1000).toFixed(1)} t in motion`} accent="bg-violet-500/20" /></motion.div>
      </div>

      <Card className="p-5">
        <CardHeader title="Status pipeline" subtitle="Where every shipment sits right now" />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-7">
          {['Booked', 'In Transit', 'At Port', 'Customs Hold', 'Out for Delivery', 'Delayed', 'Delivered'].map((st) => (
            <Link key={st} to={`/shipments?status=${encodeURIComponent(st)}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:border-cyan-400/30 hover:bg-cyan-500/5">
              <div className="font-display text-2xl font-bold text-white">{data.status_dist[st] || 0}</div>
              <StatusBadge status={st} size="xs" />
            </Link>
          ))}
        </div>
        <div className="mx-5 mb-5 flex h-2.5 overflow-hidden rounded-full bg-white/5">
          {PIPELINE.map((st) => {
            const v = data.status_dist[st] || 0;
            const pct = k.total ? (v / k.total) * 100 : 0;
            const colors: Record<string, string> = { Booked: '#38bdf8', 'In Transit': '#22d3ee', 'At Port': '#a78bfa', 'Out for Delivery': '#2dd4bf', Delivered: '#34d399' };
            return <div key={st} style={{ width: `${pct}%`, background: colors[st] }} title={`${st}: ${v}`} />;
          })}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Live global network" subtitle={`${activeRoutes.length} active routes tracked`} action={<span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE</span>} />
          <div className="px-5 pb-5">
            <RouteMap routes={activeRoutes} height={320} />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(data.mode_dist).map(([mode, count]) => {
                const Icon = MODE_ICONS[mode] || Ship;
                return (
                  <div key={mode} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <Icon className="h-4 w-4" style={{ color: MODE_COLORS[mode] }} />
                    <div>
                      <div className="text-sm font-bold text-white">{count}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{mode}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Needs attention" subtitle="Overdue and at-risk shipments" action={<Link to="/exceptions" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">View all</Link>} />
          <div className="flex flex-col gap-2.5 px-5 pb-5">
            {priority.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Everything is on track.</p>}
            {priority.map((s) => (
              <Link key={s.id} to={`/shipments/${s.id}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:border-cyan-400/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-cyan-300">{s.tracking_number}</span>
                  <StatusBadge status={s.status} size="xs" />
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">{s.origin?.code} → {s.destination?.code} · ETA {formatDate(s.eta)}</div>
                <ProgressBar value={s.progress_pct} className="mt-2" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Tracking activity" subtitle="Events per day · last 14 days" />
          <div className="px-5 pb-5"><BarChart data={activity} /></div>
        </Card>
        <Card>
          <CardHeader title="Shipment mix" subtitle="By current status" />
          <div className="px-5 pb-5"><DonutChart data={donut} /></div>
        </Card>
        <Card>
          <CardHeader title="Live event stream" subtitle="Latest carrier updates" />
          <div className="flex max-h-[260px] flex-col gap-3 overflow-y-auto px-5 pb-5">
            {data.recent_events.map((e) => (
              <div key={e.id} className="flex gap-3 text-xs">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                <div>
                  <p className="text-slate-300"><span className="font-semibold text-white">{e.location}</span> · {e.description}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{timeAgo(e.timestamp)} · {formatDate(e.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

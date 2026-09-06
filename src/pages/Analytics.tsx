import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, DollarSign, Timer } from 'lucide-react';
import { apiGet } from '../lib/api';
import type { Carrier, DashboardData, Shipment } from '../lib/types';
import { Card, CardHeader, Spinner, ErrorBanner } from '../components/ui';
import { BarChart, DonutChart, HBar } from '../components/Charts';
import { formatMoney } from '../lib/format';

const MODE_COLORS: Record<string, string> = { Ocean: '#38bdf8', Air: '#a78bfa', Road: '#34d399', Rail: '#fbbf24' };

export default function Analytics() {
  const [ships, setShips] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, c, d] = await Promise.all([
        apiGet<Shipment[]>('/api/shipments'),
        apiGet<Carrier[]>('/api/carriers'),
        apiGet<DashboardData>('/api/dashboard'),
      ]);
      setShips(s); setCarriers(c); setDash(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
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

  const stats = useMemo(() => {
    const delivered = ships.filter((s) => s.status === 'Delivered' && s.ship_date && (s.actual_delivery || s.eta));
    let transitSum = 0; let transitN = 0;
    delivered.forEach((s) => {
      const end = s.actual_delivery || s.eta!;
      const days = (new Date(end).getTime() - new Date(s.ship_date).getTime()) / 86400000;
      if (days >= 0 && days < 365) { transitSum += days; transitN++; }
    });
    const byMode: Record<string, { n: number; cost: number }> = {};
    ships.forEach((s) => {
      const m = byMode[s.mode] || (byMode[s.mode] = { n: 0, cost: 0 });
      m.n++; m.cost += Number(s.cost_usd) || 0;
    });
    return { avgTransit: transitN ? transitSum / transitN : 0, byMode };
  }, [ships]);

  if (loading) return <Spinner label="Crunching performance data..." />;
  if (error && !dash) return <ErrorBanner message={error} onRetry={load} />;
  if (!dash) return null;

  const activity = dash.activity_per_day.map((d) => ({
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' }),
    value: d.count,
  }));
  const modeDonut = Object.entries(dash.mode_dist).map(([label, value]) => ({ label, value, color: MODE_COLORS[label] || '#94a3b8' }));
  const topCarriers = [...carriers].sort((a, b) => (b.total_shipments || 0) - (a.total_shipments || 0)).slice(0, 6);
  const maxCarrierVol = Math.max(1, ...topCarriers.map((c) => c.total_shipments || 0));
  const maxCost = Math.max(1, ...Object.values(stats.byMode).map((m) => m.cost));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Performance Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">Delivery reliability, cost and carrier scorecards.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><TrendingUp className="h-4 w-4 text-emerald-400" /> On-time delivery</div>
          <div className="mt-2 font-display text-3xl font-bold text-white">{dash.kpis.on_time_pct}%</div>
          <p className="mt-1 text-xs text-slate-500">{dash.kpis.delivered} completed shipments scored</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Timer className="h-4 w-4 text-cyan-400" /> Avg transit time</div>
          <div className="mt-2 font-display text-3xl font-bold text-white">{stats.avgTransit.toFixed(1)} <span className="text-base text-slate-400">days</span></div>
          <p className="mt-1 text-xs text-slate-500">Door-to-door across delivered freight</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><DollarSign className="h-4 w-4 text-violet-400" /> Freight spend</div>
          <div className="mt-2 font-display text-3xl font-bold text-white">{formatMoney(dash.kpis.total_cost_usd)}</div>
          <p className="mt-1 text-xs text-slate-500">Across {dash.kpis.total} shipments</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Network activity" subtitle="Tracking events per day · last 14 days" />
          <div className="px-5 pb-5"><BarChart data={activity} height={200} /></div>
        </Card>
        <Card>
          <CardHeader title="Volume by mode" subtitle="Shipment count per transport mode" />
          <div className="px-5 pb-5"><DonutChart data={modeDonut} /></div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Cost by mode" subtitle="Total freight spend per mode" />
          <div className="flex flex-col gap-4 px-5 pb-5">
            {Object.entries(stats.byMode).map(([mode, m]) => (
              <div key={mode}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{mode} · {m.n} shipments</span>
                  <span className="font-bold text-white">{formatMoney(m.cost)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${(m.cost / maxCost) * 100}%`, background: MODE_COLORS[mode] }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Carrier scorecard" subtitle="Volume and on-time reliability" action={<Link to="/network" className="flex items-center gap-1 text-xs font-semibold text-cyan-300">Manage <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          <div className="flex flex-col gap-4 px-5 pb-5">
            {topCarriers.map((c) => (
              <HBar key={c.id} label={`${c.name} (${c.mode})`} value={c.total_shipments || 0} max={maxCarrierVol} suffix={` · ${c.computed_on_time ?? c.on_time_rate}% OT`} />
            ))}
            {topCarriers.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No carrier data yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

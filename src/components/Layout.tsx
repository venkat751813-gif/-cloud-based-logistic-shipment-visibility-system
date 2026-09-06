import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, TriangleAlert, PlusCircle, BarChart3,
  Network, Container, RefreshCw, Radio,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import type { DashboardData } from '../lib/types';

const NAV = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard, end: true },
  { to: '/shipments', label: 'Shipments', icon: Package },
  { to: '/exceptions', label: 'Exceptions', icon: TriangleAlert, badge: true },
  { to: '/new', label: 'New Shipment', icon: PlusCircle },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/network', label: 'Network', icon: Network },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Layout() {
  const [excCount, setExcCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const now = useClock();
  const navigate = useNavigate();

  const loadBadge = async () => {
    try {
      const d = await apiGet<DashboardData>('/api/dashboard');
      setExcCount(d.kpis.exceptions + d.kpis.overdue);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadBadge();
    const t = setInterval(loadBadge, 30000);
    return () => clearInterval(t);
  }, []);

  const refresh = () => {
    setSpinning(true);
    window.dispatchEvent(new CustomEvent('tower:refresh'));
    loadBadge();
    setTimeout(() => setSpinning(false), 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-slate-900/40 p-5 lg:flex">
          <button onClick={() => navigate('/')} className="mb-8 flex items-center gap-3 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 shadow-lg shadow-cyan-500/30">
              <Container className="h-6 w-6 text-slate-950" />
            </span>
            <span>
              <span className="block font-display text-lg font-bold leading-tight text-white">Meridian</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Visibility Tower</span>
            </span>
          </button>
          <nav className="flex flex-col gap-1.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-cyan-500/15 text-cyan-300 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
                {item.badge && excCount > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                    {excCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Radio className="h-4 w-4 animate-pulse" /> LIVE TRACKING
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Connected to carrier EDI feeds, AIS vessel data and GPS telematics.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 lg:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600">
                  <Container className="h-4 w-4 text-slate-950" />
                </span>
                <span className="font-display font-bold text-white">Meridian</span>
              </button>
              <nav className="flex items-center gap-1 overflow-x-auto lg:hidden">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium ${isActive ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden font-mono text-xs text-slate-400 sm:block">
                  {now.toUTCString().slice(5, 25)} UTC
                </span>
                <button
                  onClick={refresh}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button
                  onClick={() => navigate('/new')}
                  className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-110 sm:flex"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> New Shipment
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6">
            <Outlet />
          </main>
          <footer className="border-t border-white/5 px-6 py-4 text-center text-[11px] text-slate-600">
            Meridian Visibility Tower · Cloud shipment visibility · Data refreshes every 30s
          </footer>
        </div>
      </div>
    </div>
  );
}

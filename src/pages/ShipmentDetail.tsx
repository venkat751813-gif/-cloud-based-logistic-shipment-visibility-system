import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, Weight, Box, DollarSign,
  Plus, FileText, Thermometer, User, Zap, Save,
} from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import type { Shipment, TrackingEvent } from '../lib/types';
import { STATUSES } from '../lib/types';
import { Card, CardHeader, StatusBadge, ProgressBar, Spinner, ErrorBanner, Modal, inputCls, labelCls, primaryBtn, ghostBtn } from '../components/ui';
import RouteMap from '../components/RouteMap';
import { formatDate, formatDateTime, formatMoney, formatWeight, daysUntil } from '../lib/format';

const NEXT_STATUS: Record<string, string> = {
  Booked: 'In Transit',
  'In Transit': 'At Port',
  'At Port': 'Out for Delivery',
  'Customs Hold': 'In Transit',
  Delayed: 'In Transit',
  Exception: 'In Transit',
  'Out for Delivery': 'Delivered',
};

const EVENT_IDEAS: Record<string, string> = {
  'In Transit': 'Departed facility. Cargo in transit to next hub.',
  'At Port': 'Arrived at transshipment port. Awaiting onward connection.',
  'Customs Hold': 'Held for customs inspection. Broker notified.',
  'Out for Delivery': 'Loaded onto final-mile vehicle for delivery.',
  Delivered: 'Delivered to consignee. Proof of delivery captured.',
  Delayed: 'Delay detected. Revised ETA being calculated.',
  Exception: 'Exception reported. Operations team investigating.',
  Booked: 'Booking confirmed with carrier.',
};

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'timeline' | 'route' | 'docs'>('timeline');
  const [showEvent, setShowEvent] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const [busy, setBusy] = useState(false);

  const [evForm, setEvForm] = useState({ location: '', status: 'In Transit', description: '' });
  const [statusForm, setStatusForm] = useState({ status: '', eta: '', location: '' });
  const [docForm, setDocForm] = useState({ name: '', type: 'Bill of Lading' });

  const load = useCallback(async () => {
    try {
      setError('');
      const [ships, evs] = await Promise.all([
        apiGet<Shipment[]>(`/api/shipments?id=${id}`),
        apiGet<TrackingEvent[]>(`/api/tracking-events?shipment_id=${id}`),
      ]);
      if (!ships.length) { setError('Shipment not found'); return; }
      setShipment(ships[0]);
      setEvents(evs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shipment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('tower:refresh', h);
    return () => window.removeEventListener('tower:refresh', h);
  }, [load]);

  if (loading) return <Spinner label="Fetching live tracking data..." />;
  if (error && !shipment) return <div className="flex flex-col gap-4"><ErrorBanner message={error} onRetry={load} /><Link to="/shipments" className="text-sm text-cyan-300">Back to shipments</Link></div>;
  if (!shipment) return null;

  const etaDays = daysUntil(shipment.eta);
  const isLate = shipment.status !== 'Delivered' && etaDays !== null && etaDays < 0;

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evForm.location.trim()) return alert('Location is required');
    setBusy(true);
    try {
      await apiSend('/api/tracking-events', 'POST', {
        shipment_id: shipment.id,
        location: evForm.location,
        status: evForm.status,
        description: evForm.description || EVENT_IDEAS[evForm.status] || 'Tracking update recorded.',
        sync_status: true,
      });
      setShowEvent(false);
      setEvForm({ location: '', status: 'In Transit', description: '' });
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const updateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiSend('/api/shipments', 'PUT', {
        id: shipment.id,
        status: statusForm.status || undefined,
        eta: statusForm.eta ? new Date(statusForm.eta).toISOString() : undefined,
        current_location: statusForm.location || undefined,
        event_location: statusForm.location || shipment.current_location,
      });
      setShowStatus(false);
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const advance = async () => {
    const next = NEXT_STATUS[shipment.status];
    if (!next) return;
    setBusy(true);
    try {
      const progress = next === 'Delivered' ? 100 : Math.min(95, shipment.progress_pct + 12 + Math.floor(Math.random() * 10));
      const loc = next === 'Delivered'
        ? shipment.destination?.city || shipment.current_location
        : next === 'Out for Delivery'
          ? `${shipment.destination?.city || 'Destination'} local depot`
          : `${shipment.destination?.city || 'Destination'} gateway`;
      await apiSend('/api/tracking-events', 'POST', {
        shipment_id: shipment.id, location: loc, status: next,
        description: EVENT_IDEAS[next], sync_status: true,
      });
      await apiSend('/api/shipments', 'PUT', { id: shipment.id, progress_pct: progress, current_location: loc });
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.name.trim()) return;
    setBusy(true);
    try {
      const docs = [...(shipment.documents || []), { name: docForm.name, type: docForm.type, added_at: new Date().toISOString() }];
      await apiSend('/api/shipments', 'PUT', { id: shipment.id, documents: docs });
      setShowDoc(false);
      setDocForm({ name: '', type: 'Bill of Lading' });
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const openStatus = () => {
    setStatusForm({ status: shipment.status, eta: shipment.eta ? shipment.eta.slice(0, 16) : '', location: shipment.current_location });
    setShowStatus(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => navigate('/shipments')} className="flex w-fit items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All shipments
      </button>

      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-sky-500 to-emerald-400" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-xl font-bold text-white sm:text-2xl">{shipment.tracking_number}</h1>
              <StatusBadge status={shipment.status} />
              {isLate && <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold uppercase text-rose-300">Overdue by {Math.abs(etaDays || 0)}d</span>}
            </div>
            <p className="mt-1.5 truncate text-sm text-slate-400">{shipment.goods_description} · {shipment.consignee}</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MapPin className="h-4 w-4 text-cyan-400" />
              {shipment.origin?.city}, {shipment.origin?.country}
              <span className="text-slate-500">→</span>
              {shipment.destination?.city}, {shipment.destination?.country}
            </div>
            <div className="mt-3 flex max-w-xl items-center gap-3">
              <ProgressBar value={shipment.progress_pct} className="flex-1" />
              <span className="text-sm font-bold text-cyan-300">{shipment.progress_pct}%</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {NEXT_STATUS[shipment.status] && (
              <button onClick={advance} disabled={busy} className={primaryBtn}>
                <Zap className="h-4 w-4" /> Simulate movement
              </button>
            )}
            <button onClick={() => setShowEvent(true)} className={ghostBtn}><Plus className="h-4 w-4" /> Log event</button>
            <button onClick={openStatus} className={ghostBtn}><Save className="h-4 w-4" /> Update</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-white/5 bg-white/5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Calendar, label: 'ETA', value: formatDate(shipment.eta) },
            { icon: MapPin, label: 'Now at', value: shipment.current_location },
            { icon: Weight, label: 'Weight', value: formatWeight(shipment.weight_kg) },
            { icon: Box, label: 'Containers', value: String(shipment.container_count ?? '—') },
            { icon: DollarSign, label: 'Cost', value: formatMoney(shipment.cost_usd) },
            { icon: User, label: 'Carrier', value: shipment.carrier?.name || '—' },
          ].map((f, i) => (
            <div key={i} className="bg-slate-900/90 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <f.icon className="h-3 w-3" /> {f.label}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white" title={f.value}>{f.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {shipment.temperature_c !== null && shipment.temperature_c !== undefined && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-200">
          <Thermometer className="h-4 w-4" /> Reefer container at {shipment.temperature_c}°C — within safe range.
        </div>
      )}

      <div className="flex gap-2">
        {(['timeline', 'route', 'docs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            {t === 'timeline' ? 'Tracking timeline' : t === 'route' ? 'Route & milestones' : `Documents (${(shipment.documents || []).length})`}
          </button>
        ))}
      </div>

      {tab === 'timeline' && (
        <Card className="p-5 sm:p-6">
          <div className="relative ml-2 border-l-2 border-white/10 pl-6">
            {[...events].reverse().map((e, i, arr) => (
              <div key={e.id} className="relative pb-7 last:pb-0">
                <span className={`absolute -left-[31px] top-0.5 h-3.5 w-3.5 rounded-full border-2 ${i === arr.length - 1 ? 'border-cyan-300 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'border-slate-600 bg-slate-800'}`} />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.status} size="xs" />
                  <span className="text-[11px] text-slate-500">{formatDateTime(e.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-white">{e.location}</p>
                <p className="mt-0.5 text-sm text-slate-400">{e.description}</p>
              </div>
            ))}
            {events.length === 0 && <p className="pb-2 text-sm text-slate-500">No tracking events yet.</p>}
          </div>
        </Card>
      )}

      {tab === 'route' && shipment.origin && shipment.destination && (
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RouteMap
              routes={[{
                origin: { lat: Number(shipment.origin.lat), lng: Number(shipment.origin.lng) },
                destination: { lat: Number(shipment.destination.lat), lng: Number(shipment.destination.lng) },
                progress: shipment.progress_pct,
              }]}
              height={380}
            />
          </div>
          <Card>
            <CardHeader title="Milestones" subtitle={`${shipment.origin.code} → ${shipment.destination.code}`} />
            <div className="flex flex-col gap-3 px-5 pb-5">
              {[
                { label: `Pickup · ${shipment.origin.name}`, done: shipment.progress_pct >= 5 },
                { label: 'Linehaul departure', done: shipment.progress_pct >= 25 },
                { label: 'Gateway / transshipment', done: shipment.progress_pct >= 55 },
                { label: 'Final-mile dispatch', done: shipment.progress_pct >= 80 },
                { label: `Delivery · ${shipment.destination.name}`, done: shipment.status === 'Delivered' },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${m.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                    {m.done ? '✓' : i + 1}
                  </span>
                  <span className={m.done ? 'text-slate-200' : 'text-slate-500'}>{m.label}</span>
                </div>
              ))}
              <div className="mt-2 rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400">
                Mode: <span className="font-semibold text-white">{shipment.mode}</span> · Shipped {formatDate(shipment.ship_date)} · ETA {formatDate(shipment.eta)}
                {shipment.actual_delivery && <span> · Delivered {formatDate(shipment.actual_delivery)}</span>}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'docs' && (
        <Card>
          <CardHeader title="Shipping documents" subtitle="Bills of lading, invoices and certificates" action={<button onClick={() => setShowDoc(true)} className={ghostBtn}><Plus className="h-4 w-4" /> Add</button>} />
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            {(shipment.documents || []).map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{d.name}</p>
                  <p className="text-[11px] text-slate-500">{d.type} · {formatDate(d.added_at)}</p>
                </div>
              </div>
            ))}
            {(!shipment.documents || shipment.documents.length === 0) && <p className="col-span-2 py-6 text-center text-sm text-slate-500">No documents attached yet.</p>}
          </div>
        </Card>
      )}

      {showEvent && (
        <Modal title="Log tracking event" onClose={() => setShowEvent(false)}>
          <form onSubmit={addEvent} className="flex flex-col gap-4">
            <div><label className={labelCls}>Location *</label><input className={inputCls} value={evForm.location} onChange={(e) => setEvForm({ ...evForm, location: e.target.value })} placeholder="e.g. Port of Singapore" /></div>
            <div><label className={labelCls}>Status</label><select className={inputCls} value={evForm.status} onChange={(e) => setEvForm({ ...evForm, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className={labelCls}>Description</label><textarea className={inputCls} rows={3} value={evForm.description} onChange={(e) => setEvForm({ ...evForm, description: e.target.value })} placeholder={EVENT_IDEAS[evForm.status]} /></div>
            <p className="text-xs text-slate-500">This will also update the shipment current location and status.</p>
            <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving...' : 'Log event'}</button>
          </form>
        </Modal>
      )}

      {showStatus && (
        <Modal title="Update shipment" onClose={() => setShowStatus(false)}>
          <form onSubmit={updateStatus} className="flex flex-col gap-4">
            <div><label className={labelCls}>Status</label><select className={inputCls} value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className={labelCls}>ETA</label><input type="datetime-local" className={inputCls} value={statusForm.eta} onChange={(e) => setStatusForm({ ...statusForm, eta: e.target.value })} /></div>
            <div><label className={labelCls}>Current location</label><input className={inputCls} value={statusForm.location} onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })} /></div>
            <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving...' : 'Save changes'}</button>
          </form>
        </Modal>
      )}

      {showDoc && (
        <Modal title="Attach document" onClose={() => setShowDoc(false)}>
          <form onSubmit={addDoc} className="flex flex-col gap-4">
            <div><label className={labelCls}>Document name *</label><input className={inputCls} value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. BOL-882134.pdf" /></div>
            <div><label className={labelCls}>Type</label><select className={inputCls} value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>{['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Customs Declaration', 'Insurance', 'Other'].map((t) => <option key={t}>{t}</option>)}</select></div>
            <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving...' : 'Attach'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

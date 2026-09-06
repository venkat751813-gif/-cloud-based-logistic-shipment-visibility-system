import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Ship, Plane, Truck, TrainFront, Mail, Phone, MapPin } from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import type { Carrier, Facility } from '../lib/types';
import { MODES, FACILITY_TYPES } from '../lib/types';
import { Card, CardHeader, Spinner, ErrorBanner, EmptyState, Modal, inputCls, labelCls, primaryBtn, ghostBtn } from '../components/ui';

const MODE_ICONS: Record<string, typeof Ship> = { Ocean: Ship, Air: Plane, Road: Truck, Rail: TrainFront };

export default function Network() {
  const [tab, setTab] = useState<'carriers' | 'facilities'>('carriers');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | 'carrier' | 'facility'>(null);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [busy, setBusy] = useState(false);
  const [cForm, setCForm] = useState({ name: '', code: '', mode: 'Ocean', contact_email: '', phone: '', website: '', on_time_rate: '90', avg_transit_days: '14' });
  const [fForm, setFForm] = useState({ name: '', code: '', type: 'Seaport', city: '', country: '', lat: '', lng: '' });

  const load = useCallback(async () => {
    try {
      setError('');
      const [c, f] = await Promise.all([apiGet<Carrier[]>('/api/carriers'), apiGet<Facility[]>('/api/facilities')]);
      setCarriers(c);
      setFacilities(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load network');
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

  const openCarrier = (c?: Carrier) => {
    setEditingCarrier(c || null);
    setEditingFacility(null);
    setCForm(c ? { name: c.name, code: c.code, mode: c.mode, contact_email: c.contact_email || '', phone: c.phone || '', website: c.website || '', on_time_rate: String(c.on_time_rate), avg_transit_days: String(c.avg_transit_days) } : { name: '', code: '', mode: 'Ocean', contact_email: '', phone: '', website: '', on_time_rate: '90', avg_transit_days: '14' });
    setModal('carrier');
  };

  const openFacility = (f?: Facility) => {
    setEditingFacility(f || null);
    setEditingCarrier(null);
    setFForm(f ? { name: f.name, code: f.code, type: f.type, city: f.city, country: f.country, lat: String(f.lat), lng: String(f.lng) } : { name: '', code: '', type: 'Seaport', city: '', country: '', lat: '', lng: '' });
    setModal('facility');
  };

  const saveCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cForm.name.trim()) return alert('Name is required');
    setBusy(true);
    try {
      const payload = { ...cForm, on_time_rate: Number(cForm.on_time_rate) || 90, avg_transit_days: Number(cForm.avg_transit_days) || 14 };
      if (editingCarrier) await apiSend('/api/carriers', 'PUT', { id: editingCarrier.id, ...payload });
      else await apiSend('/api/carriers', 'POST', payload);
      setModal(null);
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  const saveFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fForm.name.trim()) return alert('Name is required');
    setBusy(true);
    try {
      const payload = { ...fForm, lat: Number(fForm.lat) || 0, lng: Number(fForm.lng) || 0 };
      if (editingFacility) await apiSend('/api/facilities', 'PUT', { id: editingFacility.id, ...payload });
      else await apiSend('/api/facilities', 'POST', payload);
      setModal(null);
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  const remove = async (kind: 'carrier' | 'facility', id: number) => {
    if (!confirm(`Delete this ${kind}?`)) return;
    try {
      await apiSend(kind === 'carrier' ? '/api/carriers' : '/api/facilities', 'DELETE', { id });
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  };

  if (loading) return <Spinner label="Loading network..." />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Carrier Network</h1>
          <p className="mt-1 text-sm text-slate-400">{carriers.length} carriers · {facilities.length} facilities worldwide</p>
        </div>
        <button onClick={() => (tab === 'carriers' ? openCarrier() : openFacility())} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-110">
          <Plus className="h-4 w-4" /> Add {tab === 'carriers' ? 'carrier' : 'facility'}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="flex gap-2">
        {(['carriers', 'facilities'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            {t} ({t === 'carriers' ? carriers.length : facilities.length})
          </button>
        ))}
      </div>

      {tab === 'carriers' && (
        carriers.length === 0 ? <EmptyState title="No carriers" subtitle="Add your first carrier to start booking shipments." /> : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {carriers.map((c) => {
              const Icon = MODE_ICONS[c.mode] || Ship;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 font-display text-sm font-bold text-cyan-300">{c.code}</span>
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-white">{c.name} <Icon className="h-3.5 w-3.5 text-slate-500" /></div>
                        <div className="text-xs text-slate-500">{c.mode} freight {!c.active && '· inactive'}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openCarrier(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove('carrier', c.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white/[0.03] p-2"><div className="font-display text-lg font-bold text-white">{c.computed_on_time ?? c.on_time_rate}%</div><div className="text-[10px] uppercase text-slate-500">On-time</div></div>
                    <div className="rounded-lg bg-white/[0.03] p-2"><div className="font-display text-lg font-bold text-white">{c.avg_transit_days}d</div><div className="text-[10px] uppercase text-slate-500">Avg transit</div></div>
                    <div className="rounded-lg bg-white/[0.03] p-2"><div className="font-display text-lg font-bold text-white">{c.active_shipments ?? 0}</div><div className="text-[10px] uppercase text-slate-500">Active</div></div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
                    {c.contact_email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.contact_email}</span>}
                    {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'facilities' && (
        facilities.length === 0 ? <EmptyState title="No facilities" subtitle="Add ports, airports and warehouses to your network." /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Facility</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Coords</th><th className="px-5 py-3">Throughput</th><th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((f) => (
                    <tr key={f.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3"><span className="font-mono text-xs font-bold text-cyan-300">{f.code}</span> <span className="ml-1 font-medium text-white">{f.name}</span></td>
                      <td className="px-5 py-3 text-slate-300">{f.type}</td>
                      <td className="px-5 py-3 text-slate-300"><span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-500" />{f.city}, {f.country}</span></td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{Number(f.lat).toFixed(1)}, {Number(f.lng).toFixed(1)}</td>
                      <td className="px-5 py-3 text-slate-300">{f.throughput ?? 0} <span className="text-slate-500">({f.active ?? 0} active)</span></td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => openFacility(f)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove('facility', f.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {modal === 'carrier' && (
        <Modal title={editingCarrier ? 'Edit carrier' : 'Add carrier'} onClose={() => setModal(null)}>
          <form onSubmit={saveCarrier} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Name *</label><input className={inputCls} value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} /></div>
              <div><label className={labelCls}>Code</label><input className={inputCls} value={cForm.code} onChange={(e) => setCForm({ ...cForm, code: e.target.value })} placeholder="Auto" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={labelCls}>Mode</label><select className={inputCls} value={cForm.mode} onChange={(e) => setCForm({ ...cForm, mode: e.target.value })}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div><label className={labelCls}>On-time %</label><input type="number" min="0" max="100" className={inputCls} value={cForm.on_time_rate} onChange={(e) => setCForm({ ...cForm, on_time_rate: e.target.value })} /></div>
              <div><label className={labelCls}>Avg transit (days)</label><input type="number" min="1" className={inputCls} value={cForm.avg_transit_days} onChange={(e) => setCForm({ ...cForm, avg_transit_days: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Email</label><input className={inputCls} value={cForm.contact_email} onChange={(e) => setCForm({ ...cForm, contact_email: e.target.value })} /></div>
              <div><label className={labelCls}>Phone</label><input className={inputCls} value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} /></div>
            </div>
            <div><label className={labelCls}>Website</label><input className={inputCls} value={cForm.website} onChange={(e) => setCForm({ ...cForm, website: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className={ghostBtn}>Cancel</button><button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving...' : 'Save carrier'}</button></div>
          </form>
        </Modal>
      )}

      {modal === 'facility' && (
        <Modal title={editingFacility ? 'Edit facility' : 'Add facility'} onClose={() => setModal(null)}>
          <form onSubmit={saveFacility} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Name *</label><input className={inputCls} value={fForm.name} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} /></div>
              <div><label className={labelCls}>Code</label><input className={inputCls} value={fForm.code} onChange={(e) => setFForm({ ...fForm, code: e.target.value })} placeholder="Auto" /></div>
            </div>
            <div><label className={labelCls}>Type</label><select className={inputCls} value={fForm.type} onChange={(e) => setFForm({ ...fForm, type: e.target.value })}>{FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>City</label><input className={inputCls} value={fForm.city} onChange={(e) => setFForm({ ...fForm, city: e.target.value })} /></div>
              <div><label className={labelCls}>Country</label><input className={inputCls} value={fForm.country} onChange={(e) => setFForm({ ...fForm, country: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Latitude</label><input type="number" step="any" className={inputCls} value={fForm.lat} onChange={(e) => setFForm({ ...fForm, lat: e.target.value })} /></div>
              <div><label className={labelCls}>Longitude</label><input type="number" step="any" className={inputCls} value={fForm.lng} onChange={(e) => setFForm({ ...fForm, lng: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className={ghostBtn}>Cancel</button><button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving...' : 'Save facility'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

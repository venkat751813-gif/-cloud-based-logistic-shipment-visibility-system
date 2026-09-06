import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin, Package, Calendar } from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import type { Carrier, Facility } from '../lib/types';
import { MODES, PRIORITIES } from '../lib/types';
import { Card, Spinner, ErrorBanner, inputCls, labelCls, primaryBtn, ghostBtn } from '../components/ui';

interface Form {
  origin_facility_id: string; destination_facility_id: string; carrier_id: string; mode: string;
  goods_description: string; weight_kg: string; volume_cbm: string; container_count: string;
  consignee: string; customer_name: string; priority: string; cost_usd: string; temperature_c: string;
  ship_date: string; eta: string; current_location: string;
}

const EMPTY: Form = {
  origin_facility_id: '', destination_facility_id: '', carrier_id: '', mode: 'Ocean',
  goods_description: '', weight_kg: '', volume_cbm: '', container_count: '1',
  consignee: '', customer_name: '', priority: 'Standard', cost_usd: '', temperature_c: '',
  ship_date: new Date().toISOString().slice(0, 16), eta: '', current_location: '',
};

const STEPS = [
  { icon: MapPin, label: 'Route & carrier' },
  { icon: Package, label: 'Cargo details' },
  { icon: Calendar, label: 'Schedule' },
];

export default function NewShipment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setFormState] = useState<Form>(EMPTY);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, f] = await Promise.all([apiGet<Carrier[]>('/api/carriers'), apiGet<Facility[]>('/api/facilities')]);
        setCarriers(c.filter((x) => x.active));
        setFacilities(f);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reference data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: keyof Form, v: string) => setFormState({ ...form, [k]: v });

  const validStep = () => {
    if (step === 0) {
      if (!form.origin_facility_id || !form.destination_facility_id || !form.carrier_id) return 'Select origin, destination and carrier.';
      if (form.origin_facility_id === form.destination_facility_id) return 'Origin and destination must differ.';
      return '';
    }
    if (step === 1) {
      if (!form.goods_description.trim()) return 'Describe the goods being shipped.';
      if (!form.consignee.trim()) return 'Consignee is required.';
      return '';
    }
    if (!form.eta) return 'ETA is required.';
    return '';
  };

  const next = () => {
    const v = validStep();
    if (v) { setFormError(v); return; }
    setFormError('');
    setStep(step + 1);
  };

  const submit = async () => {
    const v = validStep();
    if (v) { setFormError(v); return; }
    setSaving(true);
    try {
      const origin = facilities.find((f) => f.id === Number(form.origin_facility_id));
      const created = await apiSend<{ id: number }>('/api/shipments', 'POST', {
        origin_facility_id: Number(form.origin_facility_id),
        destination_facility_id: Number(form.destination_facility_id),
        carrier_id: Number(form.carrier_id),
        mode: form.mode,
        goods_description: form.goods_description,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        volume_cbm: form.volume_cbm ? Number(form.volume_cbm) : null,
        container_count: Number(form.container_count) || 1,
        consignee: form.consignee,
        customer_name: form.customer_name,
        priority: form.priority,
        cost_usd: form.cost_usd ? Number(form.cost_usd) : null,
        temperature_c: form.temperature_c ? Number(form.temperature_c) : null,
        ship_date: form.ship_date ? new Date(form.ship_date).toISOString() : new Date().toISOString(),
        eta: form.eta ? new Date(form.eta).toISOString() : null,
        current_location: form.current_location || (origin ? `${origin.city} — ${origin.name}` : 'Origin facility'),
        origin_name: origin ? `${origin.city} — ${origin.name}` : undefined,
      });
      navigate(`/shipments/${created.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create shipment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading network data..." />;
  if (error) return <ErrorBanner message={error} />;

  const modeCarriers = carriers.filter((c) => c.mode === form.mode);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <button onClick={() => navigate('/shipments')} className="flex w-fit items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Book a shipment</h1>
        <p className="mt-1 text-sm text-slate-400">Create a trackable shipment across your carrier network.</p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold ${i < step ? 'bg-emerald-500/20 text-emerald-300' : i === step ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-500'}`}>
              {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Step {i + 1}</div>
              <div className={`text-xs font-bold ${i === step ? 'text-white' : 'text-slate-400'}`}>{s.label}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`mx-1 h-px flex-1 ${i < step ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div><label className={labelCls}>Transport mode</label>
              <div className="grid grid-cols-4 gap-2">
                {MODES.map((m) => (
                  <button key={m} type="button" onClick={() => setFormState({ ...form, mode: m, carrier_id: '' })}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${form.mode === m ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Origin facility *</label>
                <select className={inputCls} value={form.origin_facility_id} onChange={(e) => set('origin_facility_id', e.target.value)}>
                  <option value="">Select origin...</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.city}, {f.country}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Destination facility *</label>
                <select className={inputCls} value={form.destination_facility_id} onChange={(e) => set('destination_facility_id', e.target.value)}>
                  <option value="">Select destination...</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.city}, {f.country}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Carrier * ({modeCarriers.length} operate {form.mode})</label>
              <select className={inputCls} value={form.carrier_id} onChange={(e) => set('carrier_id', e.target.value)}>
                <option value="">Select carrier...</option>
                {carriers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.mode} · {c.computed_on_time ?? c.on_time_rate}% on-time</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div><label className={labelCls}>Goods description *</label><input className={inputCls} value={form.goods_description} onChange={(e) => set('goods_description', e.target.value)} placeholder="e.g. 40ft container — consumer electronics" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Consignee *</label><input className={inputCls} value={form.consignee} onChange={(e) => set('consignee', e.target.value)} placeholder="Receiving company" /></div>
              <div><label className={labelCls}>Customer / shipper</label><input className={inputCls} value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Your client" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><label className={labelCls}>Weight (kg)</label><input type="number" min="0" className={inputCls} value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></div>
              <div><label className={labelCls}>Volume (cbm)</label><input type="number" min="0" className={inputCls} value={form.volume_cbm} onChange={(e) => set('volume_cbm', e.target.value)} /></div>
              <div><label className={labelCls}>Units</label><input type="number" min="1" className={inputCls} value={form.container_count} onChange={(e) => set('container_count', e.target.value)} /></div>
              <div><label className={labelCls}>Cost (USD)</label><input type="number" min="0" className={inputCls} value={form.cost_usd} onChange={(e) => set('cost_usd', e.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Priority</label><select className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><label className={labelCls}>Reefer temp (°C, optional)</label><input type="number" className={inputCls} value={form.temperature_c} onChange={(e) => set('temperature_c', e.target.value)} placeholder="Leave empty if ambient" /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Ship date</label><input type="datetime-local" className={inputCls} value={form.ship_date} onChange={(e) => set('ship_date', e.target.value)} /></div>
              <div><label className={labelCls}>Promised ETA *</label><input type="datetime-local" className={inputCls} value={form.eta} onChange={(e) => set('eta', e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>Starting location label</label><input className={inputCls} value={form.current_location} onChange={(e) => set('current_location', e.target.value)} placeholder="Auto-filled from origin" /></div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
              Booking will generate a tracking number, set status to <span className="font-bold text-cyan-300">Booked</span>, and post the first tracking event automatically.
            </div>
          </div>
        )}

        {formError && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</div>}

        <div className="mt-6 flex justify-between gap-3">
          <button onClick={() => (step === 0 ? navigate('/shipments') : setStep(step - 1))} className={ghostBtn}>
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 2
            ? <button onClick={next} className={primaryBtn}>Continue <ArrowRight className="h-4 w-4" /></button>
            : <button onClick={submit} disabled={saving} className={primaryBtn}><Check className="h-4 w-4" /> {saving ? 'Booking...' : 'Confirm booking'}</button>}
        </div>
      </Card>
    </div>
  );
}

import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const [{ data: shipments }, { data: events }] = await Promise.all([
      supabase.from('shipments').select('*'),
      supabase.from('tracking_events').select('*').order('timestamp', { ascending: false }).limit(300),
    ]);
    const all = shipments || [];
    const now = new Date();
    const active = all.filter((s) => s.status !== 'Delivered');
    const inTransit = all.filter((s) => ['In Transit', 'At Port', 'Out for Delivery'].includes(s.status));
    const delivered = all.filter((s) => s.status === 'Delivered');
    const exceptions = all.filter((s) => ['Delayed', 'Exception', 'Customs Hold'].includes(s.status));
    const onTimeDeliveries = delivered.filter((s) => s.actual_delivery && s.eta && new Date(s.actual_delivery) <= new Date(s.eta));
    const onTimePct = delivered.length ? Math.round((onTimeDeliveries.length / delivered.length) * 100) : 100;
    const atRisk = active.filter((s) => {
      if (!s.eta) return false;
      const diffDays = (new Date(s.eta).getTime() - now.getTime()) / 86400000;
      return diffDays < 3 && diffDays >= 0 && !['Delayed', 'Exception', 'Customs Hold'].includes(s.status);
    });
    const overdue = active.filter((s) => s.eta && new Date(s.eta) < now);

    const statusDist = {};
    all.forEach((s) => { statusDist[s.status] = (statusDist[s.status] || 0) + 1; });
    const modeDist = {};
    all.forEach((s) => { modeDist[s.mode] = (modeDist[s.mode] || 0) + 1; });

    const perDay = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      perDay[d.toISOString().slice(0, 10)] = 0;
    }
    (events || []).forEach((e) => {
      const day = new Date(e.timestamp).toISOString().slice(0, 10);
      if (day in perDay) perDay[day] += 1;
    });

    const totalCost = all.reduce((sum, s) => sum + (parseFloat(s.cost_usd) || 0), 0);
    const totalWeight = all.reduce((sum, s) => sum + (parseFloat(s.weight_kg) || 0), 0);
    const avgProgress = active.length ? Math.round(active.reduce((sum, s) => sum + (s.progress_pct || 0), 0) / active.length) : 0;

    return res.status(200).json({
      kpis: {
        total: all.length,
        active: active.length,
        in_transit: inTransit.length,
        delivered: delivered.length,
        exceptions: exceptions.length,
        on_time_pct: onTimePct,
        at_risk: atRisk.length,
        overdue: overdue.length,
        total_cost_usd: Math.round(totalCost),
        total_weight_kg: Math.round(totalWeight),
        avg_progress: avgProgress,
      },
      status_dist: statusDist,
      mode_dist: modeDist,
      activity_per_day: Object.entries(perDay).map(([date, count]) => ({ date, count })),
      recent_events: (events || []).slice(0, 10),
      at_risk_ids: atRisk.map((s) => s.id),
      overdue_ids: overdue.map((s) => s.id),
    });
  } catch (err) {
    console.error('dashboard API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

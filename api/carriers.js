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
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('carriers').select('*').order('name', { ascending: true });
      if (error) throw error;
      const { data: shipments } = await supabase.from('shipments').select('id, carrier_id, status, eta, actual_delivery');
      const enriched = (data || []).map((c) => {
        const mine = (shipments || []).filter((s) => s.carrier_id === c.id);
        const delivered = mine.filter((s) => s.status === 'Delivered');
        const onTime = delivered.filter((s) => s.actual_delivery && s.eta && new Date(s.actual_delivery) <= new Date(s.eta)).length;
        return {
          ...c,
          active_shipments: mine.filter((s) => s.status !== 'Delivered').length,
          total_shipments: mine.length,
          computed_on_time: delivered.length ? Math.round((onTime / delivered.length) * 100) : c.on_time_rate,
        };
      });
      return res.status(200).json(enriched);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name is required' });
      const payload = {
        name: body.name,
        code: body.code || body.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 4),
        mode: body.mode || 'Ocean',
        contact_email: body.contact_email || null,
        phone: body.phone || null,
        website: body.website || null,
        active: body.active !== undefined ? body.active : true,
        on_time_rate: body.on_time_rate ?? 90,
        avg_transit_days: body.avg_transit_days ?? 14,
      };
      const { data, error } = await supabase.from('carriers').insert(payload).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id is required' });
      const patch = {};
      ['name', 'code', 'mode', 'contact_email', 'phone', 'website', 'active', 'on_time_rate', 'avg_transit_days'].forEach(
        (k) => { if (body[k] !== undefined) patch[k] = body[k]; }
      );
      const { data, error } = await supabase.from('carriers').update(patch).eq('id', body.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const body = req.body || {};
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: inUse } = await supabase.from('shipments').select('id').eq('carrier_id', parseInt(id, 10)).limit(1);
      if (inUse && inUse.length) return res.status(400).json({ error: 'Carrier is assigned to shipments and cannot be deleted.' });
      const { error } = await supabase.from('carriers').delete().eq('id', parseInt(id, 10));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('carriers API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

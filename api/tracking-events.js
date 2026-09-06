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
      const { shipment_id, limit } = req.query;
      let q = supabase.from('tracking_events').select('*').order('timestamp', { ascending: false });
      if (shipment_id) q = q.eq('shipment_id', parseInt(shipment_id, 10));
      if (limit) q = q.limit(parseInt(limit, 10));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.shipment_id) return res.status(400).json({ error: 'shipment_id is required' });
      const payload = {
        shipment_id: body.shipment_id,
        timestamp: body.timestamp || new Date().toISOString(),
        location: body.location || 'En route',
        status: body.status || 'In Transit',
        description: body.description || 'Tracking update recorded.',
      };
      const { data, error } = await supabase.from('tracking_events').insert(payload).select().single();
      if (error) throw error;

      const patch = {
        current_location: payload.location,
        updated_at: new Date().toISOString(),
      };
      if (body.sync_status) {
        patch.status = payload.status;
        if (payload.status === 'Delivered') {
          patch.actual_delivery = payload.timestamp;
          patch.progress_pct = 100;
        }
      }
      await supabase.from('shipments').update(patch).eq('id', body.shipment_id);
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const body = req.body || {};
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('tracking_events').delete().eq('id', parseInt(id, 10));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('tracking-events API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

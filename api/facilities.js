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
      const { data, error } = await supabase.from('facilities').select('*').order('name', { ascending: true });
      if (error) throw error;
      const { data: shipments } = await supabase.from('shipments').select('id, origin_facility_id, destination_facility_id, status');
      const enriched = (data || []).map((f) => {
        const mine = (shipments || []).filter((s) => s.origin_facility_id === f.id || s.destination_facility_id === f.id);
        return { ...f, throughput: mine.length, active: mine.filter((s) => s.status !== 'Delivered').length };
      });
      return res.status(200).json(enriched);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'name is required' });
      const payload = {
        name: body.name,
        code: body.code || body.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 4),
        type: body.type || 'Warehouse',
        city: body.city || '',
        country: body.country || '',
        lat: body.lat ?? 0,
        lng: body.lng ?? 0,
      };
      const { data, error } = await supabase.from('facilities').insert(payload).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id is required' });
      const patch = {};
      ['name', 'code', 'type', 'city', 'country', 'lat', 'lng'].forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
      const { data, error } = await supabase.from('facilities').update(patch).eq('id', body.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const body = req.body || {};
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: inUse } = await supabase.from('shipments').select('id').or(`origin_facility_id.eq.${id},destination_facility_id.eq.${id}`).limit(1);
      if (inUse && inUse.length) return res.status(400).json({ error: 'Facility is used by shipments and cannot be deleted.' });
      const { error } = await supabase.from('facilities').delete().eq('id', parseInt(id, 10));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('facilities API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

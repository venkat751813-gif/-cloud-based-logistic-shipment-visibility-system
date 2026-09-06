import supabase from './db-client.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const MODE_PREFIX = { Ocean: 'OCN', Air: 'AIR', Road: 'ROD', Rail: 'RAL' };

function genTrackingNumber(mode) {
  const prefix = MODE_PREFIX[mode] || 'SHP';
  const rand = Math.floor(100000 + Math.random() * 900000);
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${prefix}-${rand}-${letter}`;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { status, mode, carrier_id, search, id, limit } = req.query;
      let q = supabase.from('shipments').select('*').order('updated_at', { ascending: false });
      if (status) q = q.eq('status', status);
      if (mode) q = q.eq('mode', mode);
      if (carrier_id) q = q.eq('carrier_id', parseInt(carrier_id, 10));
      if (id) q = q.eq('id', parseInt(id, 10));
      if (limit) q = q.limit(parseInt(limit, 10));
      const { data: shipments, error } = await q;
      if (error) throw error;

      let filtered = shipments || [];
      if (search) {
        const s = String(search).toLowerCase();
        filtered = filtered.filter(
          (sh) =>
            (sh.tracking_number || '').toLowerCase().includes(s) ||
            (sh.consignee || '').toLowerCase().includes(s) ||
            (sh.goods_description || '').toLowerCase().includes(s) ||
            (sh.customer_name || '').toLowerCase().includes(s) ||
            (sh.current_location || '').toLowerCase().includes(s)
        );
      }

      const [{ data: carriers }, { data: facilities }, { data: events }] = await Promise.all([
        supabase.from('carriers').select('*'),
        supabase.from('facilities').select('*'),
        supabase.from('tracking_events').select('id, shipment_id, timestamp, location, status, description').order('timestamp', { ascending: false }),
      ]);

      const carrierMap = Object.fromEntries((carriers || []).map((c) => [c.id, c]));
      const facilityMap = Object.fromEntries((facilities || []).map((f) => [f.id, f]));
      const latestByShipment = {};
      const countByShipment = {};
      (events || []).forEach((e) => {
        countByShipment[e.shipment_id] = (countByShipment[e.shipment_id] || 0) + 1;
        if (!latestByShipment[e.shipment_id]) latestByShipment[e.shipment_id] = e;
      });

      const enriched = filtered.map((sh) => ({
        ...sh,
        carrier: carrierMap[sh.carrier_id] || null,
        origin: facilityMap[sh.origin_facility_id] || null,
        destination: facilityMap[sh.destination_facility_id] || null,
        event_count: countByShipment[sh.id] || 0,
        latest_event: latestByShipment[sh.id] || null,
      }));
      return res.status(200).json(enriched);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.origin_facility_id || !body.destination_facility_id || !body.carrier_id) {
        return res.status(400).json({ error: 'origin_facility_id, destination_facility_id and carrier_id are required' });
      }
      const payload = {
        tracking_number: body.tracking_number || genTrackingNumber(body.mode || 'Ocean'),
        status: body.status || 'Booked',
        mode: body.mode || 'Ocean',
        priority: body.priority || 'Standard',
        origin_facility_id: body.origin_facility_id,
        destination_facility_id: body.destination_facility_id,
        carrier_id: body.carrier_id,
        ship_date: body.ship_date || new Date().toISOString(),
        eta: body.eta || null,
        actual_delivery: body.actual_delivery || null,
        weight_kg: body.weight_kg ?? null,
        volume_cbm: body.volume_cbm ?? null,
        container_count: body.container_count ?? 1,
        goods_description: body.goods_description || '',
        consignee: body.consignee || '',
        customer_name: body.customer_name || '',
        cost_usd: body.cost_usd ?? null,
        progress_pct: body.progress_pct ?? 5,
        current_location: body.current_location || 'Origin facility',
        temperature_c: body.temperature_c ?? null,
        documents: body.documents || [],
      };
      const { data, error } = await supabase.from('shipments').insert(payload).select().single();
      if (error) throw error;

      await supabase.from('tracking_events').insert({
        shipment_id: data.id,
        timestamp: data.ship_date,
        location: body.origin_name || 'Origin facility',
        status: 'Booked',
        description: `Shipment ${data.tracking_number} booked with carrier. Awaiting pickup.`,
      });
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id is required' });
      const { data: existing, error: fetchErr } = await supabase.from('shipments').select('*').eq('id', body.id).single();
      if (fetchErr) throw fetchErr;

      const updatable = [
        'tracking_number', 'status', 'mode', 'priority', 'origin_facility_id', 'destination_facility_id',
        'carrier_id', 'ship_date', 'eta', 'actual_delivery', 'weight_kg', 'volume_cbm',
        'container_count', 'goods_description', 'consignee', 'customer_name', 'cost_usd',
        'progress_pct', 'current_location', 'temperature_c', 'documents',
      ];
      const patch = { updated_at: new Date().toISOString() };
      updatable.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
      if (patch.status === 'Delivered' && !patch.actual_delivery && !existing.actual_delivery) {
        patch.actual_delivery = new Date().toISOString();
        patch.progress_pct = 100;
      }
      const { data, error } = await supabase.from('shipments').update(patch).eq('id', body.id).select().single();
      if (error) throw error;

      if (body.status && body.status !== existing.status) {
        await supabase.from('tracking_events').insert({
          shipment_id: body.id,
          timestamp: new Date().toISOString(),
          location: body.event_location || patch.current_location || existing.current_location || 'En route',
          status: body.status,
          description: body.event_description || `Shipment status updated to ${body.status}.`,
        });
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const body = req.body || {};
      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      await supabase.from('tracking_events').delete().eq('shipment_id', parseInt(id, 10));
      const { error } = await supabase.from('shipments').delete().eq('id', parseInt(id, 10));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('shipments API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

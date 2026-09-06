export interface Carrier {
  id: number;
  name: string;
  code: string;
  mode: string;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  active: boolean;
  on_time_rate: number;
  avg_transit_days: number;
  active_shipments?: number;
  total_shipments?: number;
  computed_on_time?: number;
}

export interface Facility {
  id: number;
  name: string;
  code: string;
  type: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  throughput?: number;
  active?: number;
}

export interface ShipmentDoc {
  name: string;
  type: string;
  added_at: string;
}

export interface TrackingEventLite {
  id: number;
  shipment_id: number;
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

export interface Shipment {
  id: number;
  tracking_number: string;
  status: string;
  mode: string;
  priority: string;
  origin_facility_id: number;
  destination_facility_id: number;
  carrier_id: number;
  ship_date: string;
  eta: string | null;
  actual_delivery: string | null;
  weight_kg: number | null;
  volume_cbm: number | null;
  container_count: number;
  goods_description: string;
  consignee: string;
  customer_name: string;
  cost_usd: number | null;
  progress_pct: number;
  current_location: string;
  temperature_c: number | null;
  documents: ShipmentDoc[];
  created_at: string;
  updated_at: string;
  carrier?: Carrier | null;
  origin?: Facility | null;
  destination?: Facility | null;
  event_count?: number;
  latest_event?: TrackingEventLite | null;
}

export interface TrackingEvent {
  id: number;
  shipment_id: number;
  timestamp: string;
  location: string;
  status: string;
  description: string;
  created_at: string;
}

export interface DashboardData {
  kpis: {
    total: number;
    active: number;
    in_transit: number;
    delivered: number;
    exceptions: number;
    on_time_pct: number;
    at_risk: number;
    overdue: number;
    total_cost_usd: number;
    total_weight_kg: number;
    avg_progress: number;
  };
  status_dist: Record<string, number>;
  mode_dist: Record<string, number>;
  activity_per_day: { date: string; count: number }[];
  recent_events: TrackingEvent[];
  at_risk_ids: number[];
  overdue_ids: number[];
}

export const STATUSES = ['Booked', 'In Transit', 'At Port', 'Customs Hold', 'Out for Delivery', 'Delivered', 'Delayed', 'Exception'];
export const MODES = ['Ocean', 'Air', 'Road', 'Rail'];
export const PRIORITIES = ['Standard', 'Express', 'Critical'];
export const FACILITY_TYPES = ['Seaport', 'Airport', 'Warehouse', 'Distribution Center', 'Rail Terminal', 'Depot'];

interface RoutePoint { lat: number; lng: number; label?: string }

function project(lat: number, lng: number, w: number, h: number) {
  return { x: ((lng + 180) / 360) * w, y: ((90 - lat) / 180) * h };
}

function routePath(a: RoutePoint, b: RoutePoint, w: number, h: number): string {
  const p1 = project(a.lat, a.lng, w, h);
  const p2 = project(b.lat, b.lng, w, h);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const lift = Math.min(90, dist * 0.28);
  const cx = mx - (dy / dist) * lift;
  const cy = my + (dx / dist) * lift * 0.4 - lift * 0.55;
  return `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
}

function interp(a: RoutePoint, b: RoutePoint, t: number): RoutePoint {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export interface MapRoute {
  origin: RoutePoint;
  destination: RoutePoint;
  progress: number;
  color?: string;
  dim?: boolean;
}

export default function RouteMap({ routes, height = 300 }: { routes: MapRoute[]; height?: number }) {
  const W = 800;
  const H = 400;
  const lats = [60, 30, 0, -30, -60];
  const lngs = [-120, -60, 0, 60, 120];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1628]" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="oceanGlow" cx="50%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#0e2a4a" />
            <stop offset="100%" stopColor="#0a1628" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#oceanGlow)" />
        {lats.map((la) => {
          const { y } = project(la, 0, W, H);
          return <line key={la} x1={0} y1={y} x2={W} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth={1} />;
        })}
        {lngs.map((ln) => {
          const { x } = project(0, ln, W, H);
          return <line key={ln} x1={x} y1={0} x2={x} y2={H} stroke="rgba(148,163,184,0.12)" strokeWidth={1} />;
        })}
        {[
          { cx: 190, cy: 150, rx: 70, ry: 85 },
          { cx: 430, cy: 120, rx: 60, ry: 60 },
          { cx: 560, cy: 210, rx: 55, ry: 70 },
          { cx: 660, cy: 130, rx: 70, ry: 55 },
        ].map((e, i) => (
          <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="rgba(30,58,95,0.55)" stroke="rgba(56,189,248,0.15)" />
        ))}
        {routes.map((r, i) => {
          const d = routePath(r.origin, r.destination, W, H);
          const o = project(r.origin.lat, r.origin.lng, W, H);
          const dst = project(r.destination.lat, r.destination.lng, W, H);
          const t = Math.min(0.98, Math.max(0.02, r.progress / 100));
          const mid = interp(r.origin, r.destination, t);
          const cur = project(mid.lat, mid.lng, W, H);
          const color = r.color || '#22d3ee';
          const op = r.dim ? 0.35 : 1;
          return (
            <g key={i} opacity={op}>
              <path d={d} fill="none" stroke={color} strokeWidth={r.dim ? 1.2 : 2} strokeDasharray={r.dim ? '3 5' : '7 6'} opacity={r.dim ? 0.5 : 0.9}>
                {!r.dim && <animate attributeName="stroke-dashoffset" from="26" to="0" dur="1.6s" repeatCount="indefinite" />}
              </path>
              <circle cx={o.x} cy={o.y} r={r.dim ? 3 : 4.5} fill="#0a1628" stroke="#34d399" strokeWidth={2} />
              <circle cx={dst.x} cy={dst.y} r={r.dim ? 3 : 4.5} fill="#0a1628" stroke="#f472b6" strokeWidth={2} />
              {!r.dim && (
                <>
                  <circle cx={cur.x} cy={cur.y} r={9} fill={color} opacity={0.25}>
                    <animate attributeName="r" values="6;11;6" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={cur.x} cy={cur.y} r={4} fill={color} stroke="#fff" strokeWidth={1.2} />
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-3 flex items-center gap-4 text-[10px] font-medium text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-emerald-400" /> Origin</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-pink-400" /> Destination</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Live position</span>
      </div>
    </div>
  );
}

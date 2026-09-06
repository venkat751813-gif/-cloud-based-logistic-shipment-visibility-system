export function BarChart({ data, height = 180 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.value}`}>
          <div className="mb-1 hidden text-center text-[10px] font-bold text-cyan-300 group-hover:block">{d.value}</div>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-cyan-600/60 to-cyan-400 transition-all hover:from-cyan-500 hover:to-sky-300"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
          />
          <div className="mt-1.5 truncate text-center text-[9px] text-slate-500">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, size = 170 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segments = data.map((d) => {
    const frac = d.value / total;
    const seg = { ...d, dash: frac * C, offset: -offset };
    offset += frac * C;
    return seg;
  });
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg width={size} height={size} viewBox="0 0 160 160" className="-rotate-90">
        <circle cx={80} cy={80} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={22} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={80}
            cy={80}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={22}
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={s.offset}
            strokeLinecap="butt"
          />
        ))}
        <text x={80} y={76} textAnchor="middle" className="rotate-90 fill-white" fontSize={26} fontWeight={700} transform="rotate(90 80 80)">
          {total}
        </text>
        <text x={80} y={94} textAnchor="middle" fill="#64748b" fontSize={10} transform="rotate(90 80 80)">
          shipments
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-300">{d.label}</span>
            <span className="ml-auto pl-4 font-bold text-white">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBar({ label, value, max, color = '#22d3ee', suffix = '' }: { label: string; value: number; max: number; color?: string; suffix?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="truncate font-medium text-slate-300">{label}</span>
        <span className="ml-2 font-bold text-white">{value}{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

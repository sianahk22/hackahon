// Graphiques SVG sobres, partagés (aucune bibliothèque externe).
import { fmt } from '../ui/ui';
import { carbonLevel } from '../core/carbon';
import type { CarbonModel } from '../core/carbon';

// Bande d'intensité carbone sur 24 h (mesures puis estimations).
export function CarbonBand({ carbon, from, hours = 24 }: { carbon: CarbonModel; from: number; hours?: number }) {
  const cells = Array.from({ length: hours * 2 }, (_, k) => {
    const t = from + k * 30 * 60e3;
    const d = carbon.at(t + 15 * 60e3);
    return { t, d };
  });
  const vals = cells.map(c => c.d.value).filter((v): v is number => v !== undefined);
  const min = Math.min(...vals), max = Math.max(...vals);
  const color = (v?: number) => {
    if (v === undefined) return 'var(--surface-3)';
    const tone = carbonLevel(v).tone;
    return tone === 'good' ? (v - min < (max - min) * .35 ? 'var(--sage)' : '#8FBF9F') : tone === 'warn' ? '#E9B872' : '#D9826B';
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 2, height: 28 }} role="img"
        aria-label={`Intensité carbone sur ${hours} heures, de ${vals.length ? Math.round(min) : '?'} à ${vals.length ? Math.round(max) : '?'} g CO₂/kWh`}>
        {cells.map(c => (
          <span key={c.t} title={`${fmt.time(c.t)} · ${c.d.value !== undefined ? Math.round(c.d.value) + ' g CO₂/kWh' : 'indisponible'} · ${c.d.status}`}
            style={{ background: color(c.d.value), borderRadius: 3, opacity: c.d.status === 'mesure' ? 1 : .8, outline: c.d.status === 'mesure' ? '1px solid rgba(4,34,23,.15)' : undefined }} />
        ))}
      </div>
      <div className="between xs muted" style={{ marginTop: 6 }}>
        {[0, .25, .5, .75, 1].map(p => <span key={p}>{fmt.hour(from + p * hours * 3600e3)}</span>)}
      </div>
    </div>
  );
}

// Courbe simple (aire) pour des séries temporelles agrégées.
export function AreaChart({ points, unit, height = 140, label }: { points: { k: string; v: number }[]; unit: string; height?: number; label: string }) {
  if (!points.length) return null;
  const W = 600, H = height, pad = 24;
  const max = Math.max(...points.map(p => p.v)) || 1;
  const x = (i: number) => pad + (W - 2 * pad) * (points.length === 1 ? .5 : i / (points.length - 1));
  const y = (v: number) => H - pad - (H - 2 * pad) * v / max;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)} ${H - pad} L${x(0)} ${H - pad} Z`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--teal)" stopOpacity=".22" /><stop offset="1" stopColor="var(--teal)" stopOpacity="0" /></linearGradient></defs>
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--border)" />
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke="var(--teal)" strokeWidth="2" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].v)} r="3.5" fill="var(--teal)" />
      <text x={pad} y={14} fontSize="11" fill="var(--muted)">max {max.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} {unit}</text>
      <text x={pad} y={H - 6} fontSize="11" fill="var(--muted)">{points[0].k}</text>
      <text x={W - pad} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">{points[points.length - 1].k}</text>
    </svg>
  );
}

// Barres horizontales (classements).
export function Bars({ rows, unit }: { rows: { label: string; v: number; note?: string }[]; unit: string }) {
  const max = Math.max(...rows.map(r => r.v), 1);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      {rows.map(r => (
        <li key={r.label} style={{ display: 'grid', gap: 4 }}>
          <div className="between small"><span>{r.label}</span><span className="num">{r.v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} {unit}{r.note ? ` · ${r.note}` : ''}</span></div>
          <span style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${r.v / max * 100}%`, background: 'var(--sage)', borderRadius: 3 }} /></span>
        </li>
      ))}
    </ul>
  );
}

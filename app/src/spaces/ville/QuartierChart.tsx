// Production solaire et consommation du quartier sur 24 h (même graphique que l'application de base).
import { CAP, SLOTS, label } from '../../engine';
import type { QuartierResult } from '../../engine/quartier';

export default function QuartierChart({ on, off, coord, slot }: { on: QuartierResult; off: QuartierResult; coord: boolean; slot: number }) {
  const W = 960, H = 280, pl = 46, pr = 14, pt = 26, pb = 28;
  const maxY = Math.ceil(Math.max(CAP * 1.15, ...on.prod, ...off.cons, ...on.cons) / 20) * 20;
  const x = (i: number) => pl + (W - pl - pr) * i / SLOTS;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / maxY);
  const line = (arr: number[]) => arr.map((v, i) => (i ? 'L' : 'M') + x(i + .5).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = `M${x(0)} ${y(0)} ` + on.prod.map((v, i) => `L${x(i + .5).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') + ` L${x(SLOTS)} ${y(0)} Z`;
  const grid: number[] = []; for (let v = 0; v <= maxY; v += 20) grid.push(v);
  const ticks: number[] = []; for (let i = 0; i <= SLOTS; i += 8) ticks.push(i);
  const nx = x(slot + .5);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Production solaire et consommation du quartier sur 24 heures">
      <defs>
        <linearGradient id="prodFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--amber)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--amber)" stopOpacity=".05" />
        </linearGradient>
      </defs>
      {grid.map(v => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--border)" />
          <text x={pl - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}</text>
        </g>
      ))}
      {ticks.map(i => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{label(i % SLOTS)}</text>)}
      <text x={pl - 8} y={12} textAnchor="end" fontSize="11" fill="var(--muted)">kW</text>
      <path d={area} fill="url(#prodFill)" stroke="var(--amber)" strokeWidth="1.5" />
      <line x1={pl} x2={W - pr} y1={y(CAP)} y2={y(CAP)} stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="6 4" />
      <text x={W - pr - 4} y={y(CAP) - 6} textAnchor="end" fontSize="11" fill="var(--danger)">Capacité du poste · {CAP} kW</text>
      <path d={line(off.cons)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 4" />
      <path d={line(on.cons)} fill="none" stroke="var(--teal)" strokeWidth="2.5" style={{ opacity: coord ? 1 : .35 }} />
      <line x1={nx} x2={nx} y1={pt} y2={H - pb} stroke="var(--ink)" strokeOpacity=".5" />
    </svg>
  );
}

export function ChartLegend() {
  const item = (swatch: React.ReactNode, text: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{swatch}{text}</span>;
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
      {item(<i style={{ width: 14, height: 10, background: 'var(--amber)', opacity: .6, borderRadius: 2 }} />, 'Production solaire')}
      {item(<i style={{ width: 18, height: 3, background: 'var(--teal)' }} />, 'Consommation avec Le Bon Moment')}
      {item(<i style={{ width: 18, borderTop: '2px dashed var(--muted)' }} />, 'Sans coordination (habitudes)')}
      {item(<i style={{ width: 18, borderTop: '2px dashed var(--danger)' }} />, 'Capacité du poste')}
    </div>
  );
}

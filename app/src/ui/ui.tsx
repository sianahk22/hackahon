import { useEffect, useId, useRef, type ReactNode } from 'react';
import { SCENARIOS, type ScenarioId } from '../engine';
import { STATUS_LABEL, type Datum } from '../core/datum';

// Icône Material Symbols (même jeu que les maquettes Stitch). Décorative par défaut.
export function Icon({ name, label, size, fill, className }: { name: string; label?: string; size?: number; fill?: boolean; className?: string }) {
  return (
    <span className={'ms' + (className ? ' ' + className : '')} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : undefined }}>{name}</span>
  );
}

export function Logo({ sub }: { sub?: string }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
        <Icon name="spa" size={18} />
      </span>
      <span style={{ display: 'grid', lineHeight: 1 }}>
        <span className="serif italic" style={{ fontSize: 20, color: 'var(--primary)' }}>Le Bon Moment</span>
        {sub && <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 3, fontWeight: 500 }}>{sub}</span>}
      </span>
    </span>
  );
}

// Pastille indiquant la nature d'une donnée, avec sa provenance au survol / focus.
export function DatumBadge({ d, demo }: { d: Datum<unknown>; demo?: boolean }) {
  const title = [d.source && `Source : ${d.source}`, d.method && `Méthode : ${d.method}`, d.at && `Horodatage : ${new Date(d.at).toLocaleString('fr-FR')}`, d.reason, d.howTo].filter(Boolean).join('\n');
  if (demo) return <span className="datum demo" title={title} tabIndex={0}>Démo</span>;
  return <span className={'datum ' + d.status} title={title || undefined} tabIndex={title ? 0 : undefined}>{STATUS_LABEL[d.status]}</span>;
}

export function Missing({ d }: { d: Datum<unknown> }) {
  return (
    <span className="small muted" style={{ display: 'inline-grid', gap: 2 }}>
      <span>{d.reason ?? 'Donnée indisponible'}</span>
      {d.howTo && <span className="xs">{d.howTo}</span>}
    </span>
  );
}

export function EmptyState({ icon = 'inventory_2', title, children, actions }: { icon?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <strong style={{ fontWeight: 500 }}>{title}</strong>
      {children && <div className="small muted">{children}</div>}
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const id = useId(), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref} style={wide ? { width: 'min(900px, 100%)' } : undefined}>
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

// ---------- Formats ----------
export const fmt = {
  kwh: (v: number) => (v >= 1000 ? (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' MWh' : v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 2 : 0 }) + ' kWh'),
  co2: (g: number) => (Math.abs(g) >= 1000 ? (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' kg' : Math.round(g).toLocaleString('fr-FR') + ' g'),
  eur: (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }),
  time: (t: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(t)).replace(':', ' h '),
  hour: (t: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric' }).format(new Date(t)).replace(' ', ''),
  day: (t: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t)),
  dayKey: (t: number) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)),
  rel: (t: number, now = Date.now()) => {
    const a = fmt.dayKey(t), b = fmt.dayKey(now), c = fmt.dayKey(now + 864e5);
    return a === b ? 'Aujourd’hui' : a === c ? 'Demain' : new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric' }).format(new Date(t));
  },
  // Plages réelles d'une option (un cycle interruptible peut être découpé en plusieurs morceaux).
  slots: (slots: number[]) => {
    const out: string[] = []; let a = slots[0], b = slots[0];
    for (const t of [...slots.slice(1), NaN]) {
      if (t === b + 15 * 60e3) { b = t; continue; }
      out.push(`${fmt.time(a)} – ${fmt.time(b + 15 * 60e3)}`); a = b = t;
    }
    return out.join(', ');
  },
  date: (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }),
};

// ---------- Utilisés par le Simulateur (ancien jumeau fictif) ----------
export function DemoBadge({ children = 'Données de démonstration' }: { children?: ReactNode }) {
  return <span className="datum demo" style={{ fontSize: 11, padding: '3px 10px' }}><Icon name="science" size={14} />{children}</span>;
}
export function Kpi({ label, value, sub, hl }: { label: string; value: ReactNode; sub?: ReactNode; hl?: boolean }) {
  return (
    <div className={'kpi' + (hl ? ' hl' : '')}>
      <div className="eyebrow">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}
export function ScenarioChips({ value, onChange }: { value: ScenarioId; onChange: (s: ScenarioId) => void }) {
  return (
    <div className="chips" role="group" aria-label="Type de journée" style={{ flexWrap: 'wrap' }}>
      {(Object.keys(SCENARIOS) as ScenarioId[]).map(k => (
        <button key={k} type="button" className="chip" aria-pressed={k === value} onClick={() => onChange(k)}>{SCENARIOS[k].nom} · {SCENARIOS[k].tempo}</button>
      ))}
    </div>
  );
}
export function LegalFooter() {
  return (
    <footer className="legal">
      Simulation : quartier, consommations et production sont fictifs. Seuls les prix Tempo EDF sont réels (TTC, en vigueur depuis le
      1er août 2026). Prix de l'électricité solaire partagée fixé à 0,11 €/kWh pour la simulation. Planificateur glouton simplifié.
    </footer>
  );
}

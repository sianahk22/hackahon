// Statistiques calculées UNIQUEMENT à partir des mesures enregistrées (Reading).
// Pas de mesure = pas de chiffre : on renvoie « indisponible », jamais zéro.
import type { Datum } from './datum';
import type { CarbonModel } from './carbon';
import type { Building, Category, Device, Reading, Site, Zone } from './types';

export type Dimension = 'equipement' | 'categorie' | 'batiment' | 'zone' | 'site';
export type Period = 'jour' | 'semaine' | 'mois' | 'annee';

export interface Lookups { devices: Device[]; categories: Category[]; buildings: Building[]; zones: Zone[]; sites: Site[] }

export function keyOf(r: Reading, dim: Dimension, L: Lookups): { key: string; label: string } {
  const d = r.deviceId ? L.devices.find(x => x.id === r.deviceId) : undefined;
  if (!d) return { key: '_compteur', label: 'Compteur général (non ventilé)' };
  const b = d.buildingId ? L.buildings.find(x => x.id === d.buildingId) : undefined;
  switch (dim) {
    case 'equipement': return { key: d.id, label: d.name };
    case 'categorie': { const c = L.categories.find(x => x.id === d.categoryId); return { key: d.categoryId, label: c?.name ?? 'Sans catégorie' }; }
    case 'batiment': return b ? { key: b.id, label: b.name } : { key: '_none', label: 'Non rattaché à un bâtiment' };
    case 'zone': { const zid = d.zoneId ?? b?.zoneId; const z = L.zones.find(x => x.id === zid); return z ? { key: z.id, label: z.name } : { key: '_none', label: 'Hors zone' }; }
    case 'site': { const sid = d.siteId ?? b?.siteId; const s = L.sites.find(x => x.id === sid); return s ? { key: s.id, label: s.name } : { key: '_none', label: 'Sans site' }; }
  }
}

export function periodKey(iso: string, p: Period) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  if (p === 'jour') return day;
  if (p === 'mois') return day.slice(0, 7);
  if (p === 'annee') return day.slice(0, 4);
  // Semaine ISO
  const t = new Date(day + 'T12:00:00Z');
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow + 3);
  const y = t.getUTCFullYear();
  const w = 1 + Math.floor((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 / 7); // t = jeudi de la semaine
  return `${y}-S${String(w).padStart(2, '0')}`;
}

export interface Row { key: string; label: string; kWh: number; co2kg?: number; co2Coverage: number; n: number }

// Émissions : kWh × intensité éCO2mix du quart d'heure de la mesure (estimation calculée).
// co2Coverage = part de l'énergie pour laquelle l'intensité est connue.
export function aggregate(readings: Reading[], dim: Dimension, L: Lookups, carbon?: CarbonModel): Row[] {
  const rows = new Map<string, Row>();
  const covered = new Map<string, number>();
  for (const r of readings) {
    const { key, label } = keyOf(r, dim, L);
    const row = rows.get(key) ?? { key, label, kWh: 0, co2kg: 0, co2Coverage: 0, n: 0 };
    row.kWh += r.kWh; row.n++;
    const mid = (new Date(r.start).getTime() + new Date(r.end).getTime()) / 2;
    const ci = carbon?.at(mid);
    if (ci && ci.status === 'mesure' && ci.value !== undefined) {
      row.co2kg! += r.kWh * ci.value / 1000;
      covered.set(key, (covered.get(key) ?? 0) + r.kWh);
    }
    rows.set(key, row);
  }
  return [...rows.values()].map(row => {
    const c = (covered.get(row.key) ?? 0) / (row.kWh || 1);
    return { ...row, co2Coverage: c, co2kg: c > 0 ? row.co2kg : undefined };
  }).sort((a, b) => b.kWh - a.kWh);
}

export function series(readings: Reading[], p: Period) {
  const m = new Map<string, number>();
  for (const r of readings) { const k = periodKey(r.start, p); m.set(k, (m.get(k) ?? 0) + r.kWh); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ k, kWh: v }));
}

export function total(readings: Reading[]): Datum {
  if (!readings.length) return { status: 'indisponible', reason: 'Aucune mesure enregistrée', howTo: 'Importez un relevé (CSV) ou connectez un compteur.' };
  const imported = readings.every(r => r.source !== 'demo');
  return { status: 'mesure', value: readings.reduce((s, r) => s + r.kWh, 0), unit: 'kWh', source: imported ? 'Relevés importés' : 'Jeu de démonstration' };
}

// Anomalies détectables sur données réelles :
// un jour dont la consommation dépasse la moyenne + 3 écarts-types (au moins 14 jours de données).
export interface Anomaly { key: string; label: string; day: string; kWh: number; mean: number; sd: number }
export function anomalies(readings: Reading[], L: Lookups): Anomaly[] {
  const out: Anomaly[] = [];
  const byDevice = new Map<string, Reading[]>();
  readings.forEach(r => { const k = r.deviceId ?? '_compteur'; byDevice.set(k, [...(byDevice.get(k) ?? []), r]); });
  byDevice.forEach((rs, k) => {
    const days = series(rs, 'jour');
    if (days.length < 14) return;
    const vals = days.map(d => d.kWh);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    if (sd === 0) return;
    const label = keyOf(rs[0], 'equipement', L).label;
    days.forEach(d => { if (d.kWh > mean + 3 * sd) out.push({ key: k, label, day: d.k, kWh: d.kWh, mean, sd }); });
  });
  return out.sort((a, b) => b.day.localeCompare(a.day));
}

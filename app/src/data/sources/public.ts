// Sources publiques réelles, vérifiées le 28/10/2026 (accessibles sans clé, CORS autorisé).
// - éCO2mix temps réel (RTE, via ODRÉ) : intensité carbone nationale au pas de 15 min.
// - Couleur Tempo : api-couleur-tempo.fr, source TIERCE non officielle qui relaie RTE.
//   La source officielle (API RTE « Tempo Like Supply Contract ») exige un compte et un
//   secret OAuth : à brancher côté serveur (voir docs/INTEGRATIONS.md).
// - geo.api.gouv.fr : communes et contours officiels. api-adresse.data.gouv.fr : adresses (BAN).
import type { CarbonPoint } from '../../core/carbon';
import type { TempoColor } from '../../core/tariffs';
import type { Territory } from '../../core/types';

async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json() as T;
  } finally { clearTimeout(timer); }
}

const ODRE = 'https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets';

// Intensité carbone mesurée sur les `days` derniers jours.
export async function fetchCarbon(days = 8): Promise<CarbonPoint[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 19);
  const url = `${ODRE}/eco2mix-national-tr/exports/json?select=date_heure,taux_co2&where=${encodeURIComponent(`taux_co2 is not null and date_heure >= "${since}"`)}&order_by=date_heure`;
  const rows = await getJson<{ date_heure: string; taux_co2: number }[]>(url);
  return rows.map(r => ({ t: new Date(r.date_heure).getTime(), g: r.taux_co2 }));
}

// Intensité carbone sur une période passée (pour le calcul des émissions des relevés importés).
export async function fetchCarbonRange(from: Date, to: Date): Promise<CarbonPoint[]> {
  const w = `taux_co2 is not null and date_heure >= "${from.toISOString().slice(0, 19)}" and date_heure <= "${to.toISOString().slice(0, 19)}"`;
  const url = `${ODRE}/eco2mix-national-tr/exports/json?select=date_heure,taux_co2&where=${encodeURIComponent(w)}&order_by=date_heure`;
  const rows = await getJson<{ date_heure: string; taux_co2: number }[]>(url, 30000);
  return rows.map(r => ({ t: new Date(r.date_heure).getTime(), g: r.taux_co2 }));
}

const TEMPO_CODES: Record<number, TempoColor> = { 1: 'BLEU', 2: 'BLANC', 3: 'ROUGE' };
export const TEMPO_COLOR_SOURCE = 'api-couleur-tempo.fr (source tierce non officielle, relais des publications RTE)';

// Couleurs Tempo connues : aujourd'hui et, après publication, demain.
export async function fetchTempoColors(): Promise<Record<string, TempoColor>> {
  const out: Record<string, TempoColor> = {};
  for (const which of ['today', 'tomorrow']) {
    try {
      const j = await getJson<{ dateJour: string; codeJour: number }>(`https://www.api-couleur-tempo.fr/api/jourTempo/${which}`);
      if (TEMPO_CODES[j.codeJour]) out[j.dateJour] = TEMPO_CODES[j.codeJour];
    } catch { /* couleur non publiée ou service indisponible : prix Tempo « indisponible » */ }
  }
  return out;
}

export async function searchCommunes(q: string) {
  const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codeDepartement,centre,population&boost=population&limit=6`;
  return getJson<{ nom: string; code: string; codeDepartement: string; centre: { coordinates: [number, number] }; population?: number }[]>(url);
}

export async function fetchTerritory(codeInsee: string): Promise<Territory> {
  const c = await getJson<{ nom: string; code: string; centre: { coordinates: [number, number] }; contour: GeoJSON.Polygon | GeoJSON.MultiPolygon }>(
    `https://geo.api.gouv.fr/communes/${encodeURIComponent(codeInsee)}?fields=nom,code,centre,contour&format=json&geometry=contour`);
  return { codeInsee: c.code, nom: c.nom, centre: c.centre.coordinates, contour: c.contour };
}

export interface BanAddress { id?: string; label: string; citycode?: string }
export async function reverseAddress(lon: number, lat: number): Promise<BanAddress | null> {
  const j = await getJson<{ features: { properties: { id?: string; label: string; citycode?: string } }[] }>(
    `https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`);
  const p = j.features[0]?.properties;
  return p ? { id: p.id, label: p.label, citycode: p.citycode } : null;
}

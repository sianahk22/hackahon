// Intensité carbone de l'électricité (g CO₂/kWh) pour un instant donné.
// - Passé couvert par les mesures éCO2mix : valeur publiée (mesure réelle).
// - Futur : ESTIMATION = profil moyen des 7 derniers jours au même quart d'heure,
//   recalé sur le niveau mesuré le plus récent (écart qui s'estompe avec une constante de 12 h).
//   Au-delà de 48 h, l'estimation est signalée « peu fiable ».
import type { Datum } from './datum';
import { parisParts } from './tariffs';

export interface CarbonPoint { t: number; g: number } // t = horodatage ms (UTC)
export const ECO2MIX_SOURCE = 'RTE éCO2mix (données temps réel, plateforme ODRÉ)';
export const ESTIMATION_METHOD = 'Profil moyen des 7 derniers jours au même quart d’heure, recalé sur la dernière mesure (écart amorti sur 12 h) — éCO2mix';
const DECAY_MS = 12 * 3600e3;
const Q = 15 * 60e3;

export class CarbonModel {
  private byTime = new Map<number, number>();
  private profile = new Map<number, number>(); // quart d'heure local (0..95) -> moyenne
  readonly last?: CarbonPoint;

  constructor(points: CarbonPoint[]) {
    const sorted = points.slice().sort((a, b) => a.t - b.t);
    sorted.forEach(p => this.byTime.set(Math.floor(p.t / Q) * Q, p.g));
    this.last = sorted[sorted.length - 1];
    if (!this.last) return;
    const since = this.last.t - 7 * 24 * 3600e3;
    const acc = new Map<number, { s: number; n: number }>();
    for (const p of sorted) {
      if (p.t <= since) continue;
      const k = quarterOfDay(new Date(p.t));
      const a = acc.get(k) ?? { s: 0, n: 0 };
      a.s += p.g; a.n++; acc.set(k, a);
    }
    acc.forEach((a, k) => this.profile.set(k, a.s / a.n));
  }

  get empty() { return !this.last; }

  // Valeur la plus récente publiée ; obsolète au-delà de 2 h.
  current(now = Date.now()): Datum {
    if (!this.last) return { status: 'indisponible', reason: 'Données éCO2mix non reçues', howTo: 'Vérifiez la connexion internet puis rechargez.' };
    const old = now - this.last.t > 2 * 3600e3;
    return { status: old ? 'obsolete' : 'mesure', value: this.last.g, unit: 'g CO₂/kWh', source: ECO2MIX_SOURCE, at: new Date(this.last.t).toISOString() };
  }

  at(t: number, now = Date.now()): Datum {
    const q = Math.floor(t / Q) * Q;
    const measured = this.byTime.get(q);
    if (measured !== undefined) return { status: 'mesure', value: measured, unit: 'g CO₂/kWh', source: ECO2MIX_SOURCE, at: new Date(q).toISOString() };
    if (!this.last) return { status: 'indisponible', reason: 'Données éCO2mix non reçues' };
    if (t <= this.last.t) return { status: 'indisponible', reason: 'Pas de mesure publiée pour ce quart d’heure' };
    const base = this.profile.get(quarterOfDay(new Date(t)));
    if (base === undefined) return { status: 'indisponible', reason: 'Historique insuffisant pour estimer' };
    const ref = this.profile.get(quarterOfDay(new Date(this.last.t)));
    const offset = ref === undefined ? 0 : this.last.g - ref;
    const v = Math.max(0, base + offset * Math.exp(-(t - this.last.t) / DECAY_MS));
    const far = t - now > 48 * 3600e3;
    return { status: far ? 'peu_fiable' : 'estimation', value: Math.round(v * 10) / 10, unit: 'g CO₂/kWh', source: ECO2MIX_SOURCE, method: ESTIMATION_METHOD };
  }
}

export function quarterOfDay(d: Date) {
  const { hour, minute } = parisParts(d);
  return hour * 4 + Math.floor(minute / 15);
}

// Qualitatif pour l'affichage : seuils simples sur l'intensité française (documentés).
export function carbonLevel(g: number) {
  if (g < 40) return { label: 'Très bas carbone', tone: 'good' as const };
  if (g < 70) return { label: 'Bas carbone', tone: 'good' as const };
  if (g < 110) return { label: 'Carbone modéré', tone: 'warn' as const };
  return { label: 'Carbone élevé', tone: 'bad' as const };
}

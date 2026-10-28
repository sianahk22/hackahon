// Moteur de recommandation sur données réelles.
// Règle : 1) d'abord le CO₂ le plus bas ; 2) parmi les créneaux à moins de 5 % du meilleur CO₂,
// le moins cher (si les prix sont connus) ; 3) à égalité, le plus tôt.
// L'échéance passe avant tout : aucun créneau ne la dépasse.
import type { Datum } from './datum';
import type { CarbonModel } from './carbon';
import type { TariffSettings } from './types';
import { parisParts, priceAt, type TempoColor } from './tariffs';

const Q = 15 * 60e3;
export const CO2_TOLERANCE = .05;

export interface Need {
  powerKw: number;
  durationMin: number;
  interruptible: boolean;
  earliest: number;       // ms
  deadline: number;       // ms : le cycle doit être terminé avant
  reference?: number;     // ms : heure habituelle de lancement (pour comparer)
}

export interface Option {
  slots: number[];        // débuts de quarts d'heure (ms)
  start: number; end: number;
  co2g: Datum;            // émissions du cycle
  costEur: Datum;         // coût du cycle
  intensity: number;      // moyenne g/kWh
  quality: 'estimation' | 'mesure' | 'peu_fiable';
}

export interface Recommendation {
  feasible: boolean;
  reason?: string;
  best?: Option;
  alternatives: Option[];
  reference?: Option;
  avoidedCo2g?: Datum;    // prévision : référence - meilleur
  savedEur?: Datum;
}

interface Ctx { carbon: CarbonModel; tariff: TariffSettings; tempo: Record<string, TempoColor>; now: number }

function evaluateSlots(slots: number[], need: Need, c: Ctx): Option | null {
  const e = need.powerKw * .25; // kWh par quart d'heure
  let g = 0, cost = 0, priceOk = true, quality: Option['quality'] = 'mesure';
  const sources = new Set<string>();
  for (const t of slots) {
    const ci = c.carbon.at(t + Q / 2, c.now);
    if (ci.value === undefined || ci.status === 'indisponible') return null;
    if (ci.status === 'peu_fiable') quality = 'peu_fiable';
    else if (ci.status === 'estimation' && quality === 'mesure') quality = 'estimation';
    g += e * ci.value;
    const p = priceAt(new Date(t), c.tariff, c.tempo);
    if (p.value === undefined) priceOk = false; else { cost += e * p.value; if (p.source) sources.add(p.source); }
  }
  const start = slots[0], end = slots[slots.length - 1] + Q;
  const status = quality === 'mesure' ? 'mesure' : quality;
  return {
    slots, start, end, quality,
    intensity: g / (e * slots.length),
    co2g: { status: status === 'mesure' ? 'estimation' : status, value: g, unit: 'g CO₂', method: 'Énergie du cycle × intensité carbone du réseau', source: 'Puissance déclarée + éCO2mix' },
    costEur: priceOk
      ? { status: 'estimation', value: cost, unit: '€', method: 'Énergie du cycle × prix du kWh', source: [...sources].join(' ; ') }
      : { status: 'indisponible', reason: 'Prix du kWh inconnu sur ce créneau', howTo: 'Renseignez votre contrat d’électricité.' },
  };
}

export function recommend(need: Need, c: Ctx): Recommendation {
  const n = Math.ceil(need.durationMin / 15);
  const first = Math.ceil(Math.max(need.earliest, c.now) / Q) * Q;
  const lastStart = need.deadline - n * Q;
  if (!(need.powerKw > 0) || !(need.durationMin > 0)) return { feasible: false, reason: 'Puissance ou durée du cycle non renseignée.', alternatives: [] };
  if (lastStart < first) return { feasible: false, reason: 'L’échéance est trop proche pour la durée de ce cycle.', alternatives: [] };

  const candidates: Option[] = [];
  if (!need.interruptible) {
    for (let s = first; s <= lastStart; s += Q) {
      const o = evaluateSlots(Array.from({ length: n }, (_, k) => s + k * Q), need, c);
      if (o) candidates.push(o);
    }
  } else {
    // Coupable : on retient les n quarts d'heure les plus bas carbone avant l'échéance.
    const all: { t: number; g: number }[] = [];
    for (let t = first; t + Q <= need.deadline; t += Q) {
      const ci = c.carbon.at(t + Q / 2, c.now);
      if (ci.value !== undefined && ci.status !== 'indisponible') all.push({ t, g: ci.value });
    }
    if (all.length >= n) {
      const pick = all.slice().sort((a, b) => a.g - b.g || a.t - b.t).slice(0, n).map(x => x.t).sort((a, b) => a - b);
      const o = evaluateSlots(pick, need, c); if (o) candidates.push(o);
      // Alternative continue la plus tôt possible, pour comparaison.
      for (let s = first; s <= lastStart; s += Q) {
        const o2 = evaluateSlots(Array.from({ length: n }, (_, k) => s + k * Q), need, c);
        if (o2) candidates.push(o2);
      }
    }
  }
  if (!candidates.length) return { feasible: false, reason: 'Intensité carbone indisponible sur la période demandée.', alternatives: [] };

  const minG = Math.min(...candidates.map(o => o.co2g.value!));
  const eligible = candidates.filter(o => o.co2g.value! <= minG * (1 + CO2_TOLERANCE) + 1);
  const byCost = (a: Option, b: Option) =>
    (a.costEur.value !== undefined && b.costEur.value !== undefined ? a.costEur.value - b.costEur.value : 0)
    || a.co2g.value! - b.co2g.value! || a.start - b.start;
  const best = eligible.sort(byCost)[0];

  // Alternatives : créneaux éloignés d'au moins 90 min du choix et entre eux.
  const alternatives: Option[] = [];
  for (const o of candidates.slice().sort((a, b) => a.co2g.value! - b.co2g.value! || a.start - b.start)) {
    if ([best, ...alternatives].every(x => Math.abs(x.start - o.start) >= 90 * 60e3)) alternatives.push(o);
    if (alternatives.length === 2) break;
  }

  let reference: Option | undefined;
  if (need.reference !== undefined) {
    const s = Math.floor(need.reference / Q) * Q;
    reference = evaluateSlots(Array.from({ length: n }, (_, k) => s + k * Q), need, c) ?? undefined;
  }
  const avoidedCo2g: Datum | undefined = reference
    ? { status: 'estimation', value: reference.co2g.value! - best.co2g.value!, unit: 'g CO₂', method: 'Émissions à l’heure habituelle − émissions au créneau conseillé' }
    : undefined;
  const savedEur: Datum | undefined = reference && reference.costEur.value !== undefined && best.costEur.value !== undefined
    ? { status: 'estimation', value: reference.costEur.value - best.costEur.value, unit: '€', method: 'Coût à l’heure habituelle − coût au créneau conseillé' }
    : reference ? { status: 'indisponible', reason: 'Prix du kWh inconnu', howTo: 'Renseignez votre contrat d’électricité.' } : undefined;

  return { feasible: true, best, alternatives, reference, avoidedCo2g, savedEur };
}

// Prochaine occurrence (ms) d'une heure pile, heure de Paris, strictement après un instant.
export function nextHour(h: number, after: number) {
  const first = Math.floor(after / 3600e3) * 3600e3 + 3600e3;
  for (let k = 0; k < 50; k++) {
    const t = first + k * 3600e3;
    if (parisParts(new Date(t)).hour === h) return t;
  }
  return first + 24 * 3600e3; // inatteignable sauf heure inexistante (changement d'heure)
}

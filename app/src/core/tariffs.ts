// Prix de l'électricité par quart d'heure, selon le contrat déclaré par l'utilisateur.
import type { Datum } from './datum';
import type { TariffSettings } from './types';

export type TempoColor = 'BLEU' | 'BLANC' | 'ROUGE';

// Tarif réglementé Tempo EDF, TTC, en vigueur depuis le 1er août 2026 (€/kWh).
// Heures creuses : 22h–6h. Le « jour Tempo » va de 6h à 6h le lendemain.
export const TEMPO_PRICES: Record<TempoColor, { hp: number; hc: number }> = {
  BLEU: { hp: .1654, hc: .1356 },
  BLANC: { hp: .1921, hc: .1536 },
  ROUGE: { hp: .7295, hc: .1615 },
};
export const TEMPO_SOURCE = 'Tarif réglementé Tempo EDF, TTC au 1er août 2026';

// Fuseau de référence des tarifs et des heures creuses.
export function parisParts(d: Date) {
  const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
}

export const inRanges = (h: number, ranges: [number, number][]) =>
  ranges.some(([a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b));

// Date (AAAA-MM-JJ) du jour Tempo qui contient l'instant donné.
export function tempoDayOf(d: Date) {
  const { date, hour } = parisParts(d);
  if (hour >= 6) return date;
  return parisParts(new Date(d.getTime() - 7 * 3600e3)).date;
}

export function priceAt(d: Date, t: TariffSettings, tempoColors: Record<string, TempoColor>): Datum {
  const { hour } = parisParts(d);
  switch (t.kind) {
    case 'base':
      return t.base ? { status: 'mesure', value: t.base, unit: '€/kWh', source: 'Prix saisi par l’utilisateur (option Base)' }
        : { status: 'indisponible', reason: 'Prix du kWh non renseigné', howTo: 'Indiquez le prix du kWh figurant sur votre facture.' };
    case 'hphc': {
      if (!t.hp || !t.hc) return { status: 'indisponible', reason: 'Prix heures pleines / creuses non renseignés', howTo: 'Indiquez les deux prix figurant sur votre facture.' };
      const hc = inRanges(hour, t.hcRanges?.length ? t.hcRanges : [[22, 6]]);
      return { status: 'mesure', value: hc ? t.hc : t.hp, unit: '€/kWh', source: 'Prix saisis par l’utilisateur (option Heures creuses)' };
    }
    case 'tempo': {
      const color = tempoColors[tempoDayOf(d)];
      if (!color) return { status: 'indisponible', reason: 'Couleur Tempo de ce jour pas encore publiée', howTo: 'RTE publie la couleur du lendemain vers 10h30.' };
      const hc = inRanges(hour, [[22, 6]]);
      return { status: 'mesure', value: TEMPO_PRICES[color][hc ? 'hc' : 'hp'], unit: '€/kWh', source: `${TEMPO_SOURCE} · jour ${color.toLowerCase()}` };
    }
    default:
      return { status: 'indisponible', reason: 'Contrat d’électricité non renseigné', howTo: 'Renseignez votre contrat pour afficher les coûts.' };
  }
}

// Instant (ms) de minuit, heure de Paris, pour une date AAAA-MM-JJ (gère l'heure d'été).
export function parisDayStart(dayKey: string) {
  const [y, m, d] = dayKey.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d, 0, 0);
  for (let k = 0; k < 2; k++) { const p = parisParts(new Date(t)); t -= ((p.date === dayKey ? 0 : p.date > dayKey ? 24 : -24) * 60 + p.hour * 60 + p.minute) * 60e3; }
  return t;
}

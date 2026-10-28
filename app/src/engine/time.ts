// Temps : 48 créneaux de 30 min, de 8h aujourd'hui à 8h demain.
export const SLOTS = 48;

export const hourOf = (i: number) => (8 + i / 2) % 24;
export const label = (i: number) => {
  const m = (8 * 60 + i * 30) % 1440;
  const h = Math.floor(m / 60);
  return h + 'h' + (m % 60 ? '30' : '');
};
export const slotOfHour = (h: number) => ((h - 8 + 24) % 24) * 2; // 7h demain -> 46

export const euro = (v: number) => v.toFixed(2).replace('.', ',') + ' €';
export const tarif = (v: number) => v.toFixed(4).replace('.', ',') + ' €/kWh'; // prix exact au kWh
export const pct = (v: number) => Math.round(v * 100) + ' %';
export const kw = (v: number) => Math.round(v) + ' kW';

// Regroupe des créneaux en plages continues : [3,4,5,9] -> [[3,5],[9,9]]
export function ranges(slots: number[]): [number, number][] {
  const r: [number, number][] = [];
  let a: number | null = null, b = 0;
  for (const i of slots) {
    if (a === null) { a = b = i; } else if (i === b + 1) { b = i; } else { r.push([a, b]); a = b = i; }
  }
  if (a !== null) r.push([a, b]);
  return r;
}
export const rangeText = (slots: number[]) =>
  ranges(slots).map(([a, b]) => label(a) + '–' + label(b + 1)).join(', ');

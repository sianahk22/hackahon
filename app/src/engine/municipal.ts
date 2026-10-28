// Bâtiments municipaux et bornes publiques (espace Ville uniquement).
import { plan, type Task } from './planner';
import type { QuartierResult } from './quartier';

export interface MuniTask extends Task { name: string }

export const MUNI: MuniTask[] = [
  { name: 'Piscine · préchauffage du bassin', p: 12, dur: 8, deadline: 46, interruptible: true },
  { name: 'Gymnase · eau chaude des douches', p: 6, dur: 4, deadline: 22, interruptible: true },
  { name: '4 véhicules municipaux', p: 14.8, dur: 6, deadline: 46, interruptible: true },
];

// Les équipements municipaux se placent sur le soleil qui reste une fois le quartier servi.
export function planMuni(q: QuartierResult, w: number) {
  return plan(MUNI, q.ctx, { solar: q.prod.map((p, i) => Math.max(0, p - q.cons[i])), baseLoad: q.cons, w });
}

// Bornes publiques : approximation de démonstration, comme dans l'application de base.
export function bornesAt(q: QuartierResult, i: number) {
  const loc = q.cons[i] ? Math.min(1, q.prod[i] / q.cons[i]) : 0;
  return [
    { name: 'Parking de la mairie', local: loc, free: 2 },
    { name: 'École Jules-Ferry', local: loc * .92, free: 1 },
    { name: 'Place du marché', local: loc * .8, free: 3 },
  ];
}

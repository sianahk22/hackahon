// Quartier simulé : 30 foyers (tirage déterministe), école, boulangerie, gymnase solaire.
// Réservé à l'espace Ville : les espaces Habitant et Entreprise n'importent pas ce module.
import { ACC_PRICE, CAP, bump, slotCtx, type ScenarioId, type SlotCtx } from './scenarios';
import { plan, habitSlots, type Task } from './planner';
import { SLOTS } from './time';

export interface SimOptions { ecole: boolean; boulangerie: boolean; parking: boolean }
export interface Settings { scenario: ScenarioId; cloud: boolean; w: number; sim: SimOptions }

function rng(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const QTASKS: Task[] = (() => {
  const r = rng(42), out: Task[] = [];
  for (let f = 0; f < 30; f++) {
    if (f < 20) out.push({ p: 2.2, dur: 4, deadline: 46, interruptible: true, habit: 28 });
    out.push({ p: .8, dur: 3, deadline: 46, interruptible: false, habit: 20 + Math.floor(r() * 7) });
    if (f < 8) out.push({ p: 3.7, dur: 8, deadline: 46, interruptible: true, habit: 21 + Math.floor(r() * 3) });
    if (f < 12) out.push({ p: 1, dur: 3, deadline: 46, interruptible: false, habit: 26 + Math.floor(r() * 3) });
  }
  return out;
})();

export interface QuartierResult {
  ctx: SlotCtx[];
  prod: number[];
  parts: { res: number; ecole: number; boul: number }[];
  base: number[];
  flex: number[];
  cons: number[];
  taux: number;
  peak: number;
  cost: number;
  co2: number;
  local: number;
  P: number;
}

export function quartierSim(s: Settings, coord: boolean): QuartierResult {
  const ctx = slotCtx(s.scenario, s.cloud), winter = s.scenario !== 'ete';
  const kWc = 80 + (s.sim.parking ? 30 : 0);
  const prod = ctx.map(c => kWc * .85 * c.sun);
  const parts = ctx.map(c => {
    const h = c.h;
    let res = 30 * (.32 + .75 * bump(h, 20, 1.7) + .35 * bump(h, 7.5, 1));
    if (winter) res *= 1.4;
    const ecole = (s.sim.ecole && h >= 8.5 && h < 17) ? (winter ? 14 : 9) : 0;
    const boul = s.sim.boulangerie ? ((h >= 4 && h < 19) ? 6 : 1.2) : 0;
    return { res, ecole, boul };
  });
  const base = parts.map(p => p.res + p.ecole + p.boul);
  const slots = coord
    ? plan(QTASKS, ctx, { solar: prod.map((p, i) => Math.max(0, p - base[i])), baseLoad: base, cap: CAP, capW: 1.2, w: s.w })
    : QTASKS.map(habitSlots);
  const flex = Array(SLOTS).fill(0);
  QTASKS.forEach((t, k) => slots[k].forEach(i => flex[i] += t.p));
  const cons = base.map((b, i) => b + flex[i]);
  let local = 0, P = 0, cost = 0, co2 = 0;
  cons.forEach((c, i) => {
    const l = Math.min(c, prod[i]);
    local += l * .5; P += prod[i] * .5;
    cost += (l * ACC_PRICE + (c - l) * ctx[i].price) * .5;
    co2 += (c - l) * ctx[i].co2 * .5;
  });
  return { ctx, prod, parts, base, flex, cons, taux: P ? local / P : 0, peak: Math.max(...cons), cost, co2, local, P };
}

export const kWcOf = (sim: SimOptions) => 80 + (sim.parking ? 30 : 0);

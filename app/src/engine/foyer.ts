// Calcul pour UN foyer ou UN commerce. N'utilise que ses propres données
// (sa part de soleil, ses appareils), jamais les statistiques du quartier.
import { slotCtx, type ScenarioId, type SlotCtx } from './scenarios';
import { plan, habitSlots, evaluate, slotScore, type Evaluation, type PlanOptions } from './planner';
import type { UserProfile, UserTask } from './devices';
import { SLOTS } from './time';

export interface FoyerSettings { scenario: ScenarioId; cloud: boolean; w: number }

export interface FoyerResult {
  ctx: SlotCtx[];
  solar: number[];
  opts: PlanOptions;
  tasks: UserTask[];
  slots: number[][];
  habits: number[][];
  planned: Evaluation;
  naive: Evaluation;
  ok: boolean[];      // échéance tenue pour chaque tâche
  saved: number;      // € économisés sur la journée
  co2Kg: number;      // kg de CO2 évités sur la journée
  share: number;      // part de l'énergie flexible venant du soleil du quartier
  heat: ('good' | 'warn' | 'bad')[]; // coût du moment, par tiers
  peak: number;       // pic de puissance du foyer avec le planning (kW)
  peakNaive: number;  // pic de puissance sans l'app (kW)
}

export function computeFoyer(u: UserProfile, s: FoyerSettings): FoyerResult {
  const ctx = slotCtx(s.scenario, s.cloud);
  const solar = ctx.map(c => u.share * c.sun);
  const opts: PlanOptions = { solar, baseLoad: Array(SLOTS).fill(u.base), cap: u.cap, capW: 3, w: s.w };
  const slots = plan(u.tasks, ctx, opts);
  const habits = u.tasks.map(habitSlots);
  const planned = evaluate(u.tasks, slots, ctx, solar);
  const naive = evaluate(u.tasks, habits, ctx, solar);
  const ok = u.tasks.map((t, k) => slots[k].length === t.dur && Math.max(...slots[k]) < t.deadline);

  const scores = ctx.map((_, i) => slotScore(1, i, ctx, solar, opts.baseLoad, { solar, baseLoad: opts.baseLoad, w: s.w }));
  const sorted = scores.slice().sort((a, b) => a - b), t1 = sorted[16], t2 = sorted[32];
  const heat = scores.map(v => v <= t1 ? 'good' : v <= t2 ? 'warn' : 'bad') as FoyerResult['heat'];

  const loadOf = (arr: number[][]) => {
    const l = Array(SLOTS).fill(u.base);
    u.tasks.forEach((t, k) => arr[k].forEach(i => l[i] += t.p));
    return Math.max(...l);
  };

  return {
    ctx, solar, opts, tasks: u.tasks, slots, habits, planned, naive, ok,
    saved: naive.cost - planned.cost,
    co2Kg: (naive.co2 - planned.co2) / 1000,
    share: planned.kwh ? planned.sol / planned.kwh : 0,
    heat,
    peak: loadOf(slots),
    peakNaive: loadOf(habits),
  };
}

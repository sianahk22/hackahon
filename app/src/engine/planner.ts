// Le moteur : placement des tâches sous contraintes.
// Version gloutonne simplifiée (une tâche après l'autre), pas un solveur global.
import { ACC_PRICE, type SlotCtx } from './scenarios';
import { SLOTS } from './time';

export interface Task {
  p: number;             // puissance (kW)
  dur: number;           // durée en créneaux de 30 min
  deadline: number;      // créneau limite (exclu)
  interruptible: boolean;
  habit?: number;        // créneau de départ sans l'app
}

export interface PlanOptions {
  solar: number[];     // soleil disponible par créneau (kW)
  baseLoad: number[];  // consommation déjà présente (kW)
  cap?: number;        // puissance maximale (kW)
  capW?: number;       // poids de la pénalité de dépassement
  w: number;           // 0 = économies, 1 = écologie
}

export function slotScore(p: number, i: number, ctx: SlotCtx[], solar: number[], load: number[], o: PlanOptions) {
  const c = ctx[i];
  const loc = Math.min(p, Math.max(0, solar[i]));
  const cost = (loc * ACC_PRICE + (p - loc) * c.price) / p;
  const co2 = ((p - loc) * c.co2) / p;
  let s = (1 - o.w) * (cost / 0.73) + o.w * (co2 / 150) + 0.25 * c.tension;
  if (o.cap && load[i] + p > o.cap) s += (o.capW ?? 0) * (load[i] + p - o.cap) / p;
  return s;
}

export function plan(tasks: Task[], ctx: SlotCtx[], o: PlanOptions): number[][] {
  const solar = o.solar.slice(), load = o.baseLoad.slice(), out: number[][] = [];
  const order = tasks.map((_, k) => k).sort((a, b) =>
    (Number(tasks[a].interruptible) - Number(tasks[b].interruptible))
    || ((tasks[a].deadline - tasks[a].dur) - (tasks[b].deadline - tasks[b].dur))
    || (tasks[b].p - tasks[a].p));
  for (const k of order) {
    const t = tasks[k], sc = (i: number) => slotScore(t.p, i, ctx, solar, load, o);
    let slots: number[];
    if (!t.interruptible) {
      let best = 0, bs = Infinity;
      for (let s = 0; s + t.dur <= t.deadline; s++) {
        let sum = 0;
        for (let j = s; j < s + t.dur; j++) sum += sc(j);
        if (sum < bs - 1e-9) { bs = sum; best = s; }
      }
      slots = Array.from({ length: t.dur }, (_, j) => best + j);
    } else {
      slots = [...Array(t.deadline).keys()].sort((a, b) => sc(a) - sc(b) || a - b).slice(0, t.dur).sort((a, b) => a - b);
    }
    for (const i of slots) { const loc = Math.min(t.p, Math.max(0, solar[i])); solar[i] -= loc; load[i] += t.p; }
    out[k] = slots;
  }
  return out;
}

export const habitSlots = (t: Task) =>
  Array.from({ length: t.dur }, (_, j) => Math.min(SLOTS - 1, (t.habit ?? 0) + j));

export interface TaskResult { cost: number; co2: number; sol: number }
export interface Evaluation { cost: number; co2: number; sol: number; kwh: number; per: TaskResult[] }

export function evaluate(tasks: Task[], slotsArr: number[][], ctx: SlotCtx[], solarInit: number[]): Evaluation {
  const solar = solarInit.slice();
  let cost = 0, co2 = 0, sol = 0, kwh = 0;
  const per: TaskResult[] = [];
  tasks.forEach((t, k) => {
    let c = 0, g = 0, s = 0;
    for (const i of slotsArr[k]) {
      const e = t.p * .5, loc = Math.min(t.p, Math.max(0, solar[i]));
      solar[i] -= loc;
      const le = loc * .5, ge = e - le;
      c += le * ACC_PRICE + ge * ctx[i].price; g += ge * ctx[i].co2; s += le; kwh += e;
    }
    cost += c; co2 += g; sol += s; per[k] = { cost: c, co2: g, sol: s };
  });
  return { cost, co2, sol, kwh, per };
}

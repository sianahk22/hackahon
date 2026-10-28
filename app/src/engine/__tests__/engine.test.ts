// Non-régression : le moteur TypeScript doit donner EXACTEMENT les mêmes résultats
// que l'application de base (valeurs générées par `npm run reference`).
import { describe, it, expect } from 'vitest';
import reference from './reference.json';
import { computeFoyer, makeProfiles, type ScenarioId } from '../index';
import { quartierSim } from '../quartier';
import { planMuni } from '../municipal';

type Case = (typeof reference)[number];
const name = (c: Case) => {
  const i = c.input;
  return `${i.scenario} · nuage ${i.cloud ? 'oui' : 'non'} · w=${i.w} · école ${i.sim.ecole ? 'oui' : 'non'} · parking ${i.sim.parking ? 'oui' : 'non'}`;
};

describe.each(reference.map(c => [name(c), c] as const))('%s', (_, c) => {
  const s = { ...c.input, scenario: c.input.scenario as ScenarioId };

  it('quartier avec et sans coordination', () => {
    for (const coord of [true, false]) {
      const q = quartierSim(s, coord), ref = coord ? c.quartier.on : c.quartier.off;
      expect({ taux: q.taux, peak: q.peak, cost: q.cost, co2: q.co2, local: q.local, P: q.P, cons: q.cons, prod: q.prod }).toEqual(ref);
    }
  });

  it('bâtiments municipaux', () => {
    expect(planMuni(quartierSim(s, true), s.w)).toEqual(c.muni);
  });

  it('foyers d\'Inès et de Karim', () => {
    const profiles = makeProfiles();
    for (const id of ['ines', 'karim'] as const) {
      const f = computeFoyer(profiles[id], s), ref = c[id];
      expect(f.slots).toEqual(ref.slots);
      expect(f.habits).toEqual(ref.habits);
      expect(f.planned).toEqual(ref.planned);
      expect(f.naive).toEqual(ref.naive);
    }
  });
});

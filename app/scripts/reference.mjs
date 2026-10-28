// Exécute le moteur ORIGINAL de reference/app-base.html (sans le modifier)
// et enregistre ses résultats dans src/engine/__tests__/reference.json.
// Les tests comparent ensuite le nouveau moteur TypeScript à ces valeurs.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../reference/app-base.html', import.meta.url), 'utf8');
const start = html.indexOf('const SLOTS = 48;');
const end = html.indexOf('// ---------- Rendu : pastilles');
if (start < 0 || end < 0) throw new Error('Repères introuvables dans app-base.html');
const code = html.slice(start, end);

const load = () => new Function(code + '\nreturn { state, compute, USERS };')();

const cases = [];
for (const scenario of ['ete', 'hiver', 'rouge'])
  for (const cloud of [false, true])
    for (const w of [0, 0.35, 1])
      for (const sim of [
        { ecole: true, boulangerie: true, parking: false },
        { ecole: false, boulangerie: false, parking: true },
      ]) {
        const out = { input: { scenario, cloud, w, sim } };
        for (const user of ['ines', 'karim']) {
          const e = load(); // nouvelle instance : compteurs remis à zéro
          Object.assign(e.state, { scenario, cloud, w, user, sim: { ...sim } });
          e.compute();
          const pick = q => ({ taux: q.taux, peak: q.peak, cost: q.cost, co2: q.co2, local: q.local, P: q.P, cons: q.cons, prod: q.prod });
          out.quartier = { on: pick(e.state.q.on), off: pick(e.state.q.off) };
          out.muni = e.state.m;
          out[user] = { slots: e.state.f.slots, habits: e.state.f.habits, planned: e.state.f.planned, naive: e.state.f.naive };
        }
        cases.push(out);
      }

const dest = new URL('../src/engine/__tests__/reference.json', import.meta.url);
writeFileSync(dest, JSON.stringify(cases));
console.log(cases.length + ' cas de référence enregistrés');

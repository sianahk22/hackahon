import { describe, it, expect } from 'vitest';
import { CarbonModel } from '../carbon';
import { recommend } from '../recommend';
import { parisParts, priceAt, tempoDayOf } from '../tariffs';

const H = 3600e3, Q = 15 * 60e3;
// Instant de référence : 28 oct. 2026, 10h00 à Paris (09h00 UTC).
const NOW = Date.UTC(2026, 9, 28, 9, 0);

// Historique synthétique pour les tests : 13h–15h (Paris) très bas carbone, 19h–21h élevé.
function model(days = 8) {
  const pts = [];
  for (let t = NOW - days * 24 * H; t <= NOW; t += Q) {
    const h = parisParts(new Date(t)).hour; // heure de Paris (le passage à l'heure d'hiver a lieu le 25 oct.)
    pts.push({ t, g: h >= 13 && h < 15 ? 20 : h >= 19 && h < 21 ? 120 : 60 });
  }
  return new CarbonModel(pts);
}

describe('modèle carbone', () => {
  it('rend la mesure publiée pour le passé et une estimation pour le futur', () => {
    const m = model();
    expect(m.at(NOW - 2 * H, NOW).status).toBe('mesure');
    const f = m.at(NOW + 4 * H, NOW); // 14h Paris
    expect(f.status).toBe('estimation');
    expect(f.value).toBe(20);
  });
  it('signale une estimation au-delà de 48 h comme peu fiable', () => {
    expect(model().at(NOW + 60 * H, NOW).status).toBe('peu_fiable');
  });
  it('indique « indisponible » sans données, jamais zéro', () => {
    const d = new CarbonModel([]).at(NOW, NOW);
    expect(d.status).toBe('indisponible');
    expect(d.value).toBeUndefined();
  });
  it('marque la valeur courante obsolète après 2 h', () => {
    expect(model().current(NOW + 3 * H).status).toBe('obsolete');
  });
});

describe('recommandation', () => {
  const ctx = { carbon: model(), tariff: { kind: 'inconnu' as const }, tempo: {}, now: NOW };

  it('choisit le créneau le plus bas carbone avant l’échéance', () => {
    const r = recommend({ powerKw: 1, durationMin: 60, interruptible: false, earliest: NOW, deadline: NOW + 12 * H }, ctx);
    expect(r.feasible).toBe(true);
    const startParis = new Date(r.best!.start + H).getUTCHours();
    expect(startParis).toBeGreaterThanOrEqual(13);
    expect(r.best!.end).toBeLessThanOrEqual(NOW + 15 * H);
    expect(r.best!.co2g.value).toBeCloseTo(20); // 1 kWh × 20 g
  });

  it('ne dépasse jamais l’échéance', () => {
    const r = recommend({ powerKw: 2, durationMin: 90, interruptible: false, earliest: NOW, deadline: NOW + 2 * H }, ctx);
    expect(r.best!.end).toBeLessThanOrEqual(NOW + 2 * H);
  });

  it('refuse une échéance trop courte', () => {
    const r = recommend({ powerKw: 2, durationMin: 180, interruptible: false, earliest: NOW, deadline: NOW + H }, ctx);
    expect(r.feasible).toBe(false);
  });

  it('n’invente pas de coût quand le contrat est inconnu', () => {
    const r = recommend({ powerKw: 1, durationMin: 60, interruptible: false, earliest: NOW, deadline: NOW + 12 * H, reference: NOW + 9 * H }, ctx);
    expect(r.best!.costEur.status).toBe('indisponible');
    expect(r.savedEur!.status).toBe('indisponible');
    expect(r.avoidedCo2g!.value).toBeCloseTo(120 - 20); // 19h : 120 g, 14h : 20 g
  });

  it('à CO₂ quasi égal, choisit le moins cher', () => {
    // Intensité constante : seul le prix (heures creuses 22h–6h) départage.
    const flat = new CarbonModel(Array.from({ length: 800 }, (_, k) => ({ t: NOW - k * Q, g: 50 })));
    const r = recommend({ powerKw: 1, durationMin: 60, interruptible: false, earliest: NOW, deadline: NOW + 20 * H },
      { carbon: flat, tariff: { kind: 'hphc', hp: .25, hc: .15, hcRanges: [[22, 6]] }, tempo: {}, now: NOW });
    const startParis = new Date(r.best!.start + H).getUTCHours();
    expect(startParis).toBe(22);
    expect(r.best!.costEur.value).toBeCloseTo(.15);
  });

  it('propose des alternatives éloignées d’au moins 90 min', () => {
    const r = recommend({ powerKw: 1, durationMin: 60, interruptible: false, earliest: NOW, deadline: NOW + 20 * H }, ctx);
    for (const a of r.alternatives) expect(Math.abs(a.start - r.best!.start)).toBeGreaterThanOrEqual(90 * 60e3);
  });
});

describe('tarifs', () => {
  it('rattache 3h du matin au jour Tempo de la veille', () => {
    expect(tempoDayOf(new Date(Date.UTC(2026, 9, 28, 2, 0)))).toBe('2026-10-27');
    expect(tempoDayOf(new Date(Date.UTC(2026, 9, 28, 9, 0)))).toBe('2026-10-28');
  });
  it('donne le prix Tempo réel quand la couleur est connue, sinon indisponible', () => {
    const t = new Date(Date.UTC(2026, 9, 28, 9, 0));
    expect(priceAt(t, { kind: 'tempo' }, { '2026-10-28': 'ROUGE' }).value).toBe(.7295);
    expect(priceAt(t, { kind: 'tempo' }, {}).status).toBe('indisponible');
  });
});

describe('minuit à Paris', () => {
  it('gère l’heure d’été et l’heure d’hiver', async () => {
    const { parisDayStart } = await import('../tariffs');
    expect(new Date(parisDayStart('2026-10-24')).toISOString()).toBe('2026-10-23T22:00:00.000Z');
    expect(new Date(parisDayStart('2026-10-26')).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });
});

describe('recalage de l’estimation', () => {
  it('tient compte d’un niveau actuel supérieur à la moyenne, puis s’en rapproche', () => {
    // 7 jours à 20 g, puis une dernière mesure à 50 g.
    const pts = Array.from({ length: 700 }, (_, k) => ({ t: NOW - (k + 1) * Q, g: 20 }));
    pts.push({ t: NOW, g: 50 });
    const m = new CarbonModel(pts);
    const near = m.at(NOW + H, NOW).value!, far = m.at(NOW + 40 * H, NOW).value!;
    expect(near).toBeGreaterThan(40); // ≈ 43,7 : la dernière mesure entre aussi dans le profil de son quart d’heure
    expect(far).toBeLessThan(23);
  });
});

describe('prochaine heure pile', () => {
  it('trouve la prochaine occurrence d’une heure de Paris', async () => {
    const { nextHour } = await import('../recommend');
    // NOW = 10h00 Paris le 28/10 → 22h le même jour = 21h00 UTC
    expect(new Date(nextHour(22, NOW)).toISOString()).toBe('2026-10-28T21:00:00.000Z');
    // 7h → le lendemain 7h Paris = 06h00 UTC
    expect(new Date(nextHour(7, NOW)).toISOString()).toBe('2026-10-29T06:00:00.000Z');
  });
});

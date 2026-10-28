// Création d'un usage planifié à partir d'une option recommandée.
// Sans intégration de pilotage, un plan est toujours un RAPPEL : aucune commande n'est envoyée.
import type { Store } from '../data/store';
import { uid } from '../data/repo';
import type { Option, Recommendation } from '../core/recommend';
import type { Device, Plan } from '../core/types';
import { fmt } from '../ui/ui';

export async function planOption(s: Store, d: Device, o: Option, r?: Recommendation) {
  const p: Plan = {
    id: uid(), ownerId: s.ownerId, deviceId: d.id,
    start: new Date(o.start).toISOString(), end: new Date(o.end).toISOString(),
    mode: 'rappel', status: 'prevu',
    co2g: o.co2g.value, costEur: o.costEur.value,
    refCo2g: r?.reference?.co2g.value, refCostEur: r?.reference?.costEur.value,
    explanation: `Intensité carbone ${o.quality === 'mesure' ? 'mesurée' : 'estimée'} ≈ ${Math.round(o.intensity)} g CO₂/kWh.`,
    createdAt: new Date().toISOString(),
  };
  await s.upsert('plans', p);
  await s.log('Planification (rappel)', 'ok', d.name, `${fmt.rel(o.start)} ${fmt.time(o.start)}`);
  return p;
}

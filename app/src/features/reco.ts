// Recommandations pour les appareils d'un propriétaire, à partir des données réelles chargées.
import { useMemo } from 'react';
import { useStore } from '../data/store';
import { nextHour, recommend, type Need, type Recommendation } from '../core/recommend';
import type { Device } from '../core/types';

export interface DeviceReco { device: Device; need?: Need; reco?: Recommendation; skip?: string }

// Construit le besoin (fenêtre, échéance, heure habituelle) d'un appareil.
export function needFor(d: Device, now: number, opts: { earliest?: number; deadline?: number } = {}): { need?: Need; skip?: string } {
  if (d.essential) return { skip: 'Usage essentiel : pas de décalage proposé.' };
  if (d.critical) return { skip: 'Système critique : aucune recommandation de décalage.' };
  if (!d.powerKw || !d.cycleMinutes) return { skip: 'Renseignez la puissance et la durée du cycle pour obtenir une recommandation.' };
  // Réalisme : sans échéance déclarée, on ne propose pas de déplacer l'usage.
  if (d.constraints.deadlineHour === undefined && opts.deadline === undefined) return { skip: 'Indiquez une échéance (« terminé avant ») pour savoir si cet usage peut être décalé.' };
  const earliest = opts.earliest ?? (d.constraints.earliestHour !== undefined ? nextHour(d.constraints.earliestHour, now - 3600e3) : now);
  const deadline = opts.deadline ?? nextHour(d.constraints.deadlineHour!, Math.max(now, earliest) + d.cycleMinutes * 60e3);
  let reference: number | undefined;
  if (d.constraints.habitHour !== undefined) {
    const r = nextHour(d.constraints.habitHour, now - 3600e3);
    if (r + d.cycleMinutes * 60e3 <= deadline) reference = r;
  }
  return { need: { powerKw: d.powerKw, durationMin: d.cycleMinutes, interruptible: d.interruptible, earliest: Math.max(earliest, now), deadline, reference } };
}

export function useRecommendations(devices: Device[], now = Date.now()) {
  const s = useStore();
  const minute = Math.floor(now / 60e3);
  return useMemo<DeviceReco[]>(() => {
    const carbon = s.carbon.value;
    return devices.map(device => {
      const { need, skip } = needFor(device, minute * 60e3);
      if (!need) return { device, skip };
      if (!carbon || carbon.empty) return { device, need, skip: 'Intensité carbone indisponible pour le moment.' };
      return { device, need, reco: recommend(need, { carbon, tariff: s.settings.tariff, tempo: s.tempo.value ?? {}, now: minute * 60e3 }) };
    });
  }, [devices, s.carbon.value, s.settings.tariff, s.tempo.value, minute]);
}

// Pour l'ordre d'affichage : le plus grand gain carbone d'abord.
export const gainOf = (r: DeviceReco) => r.reco?.avoidedCo2g?.value ?? (r.reco?.feasible ? 0 : -1);

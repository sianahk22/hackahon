import { SLOTS, slotOfHour } from './time';
import type { Task } from './planner';

export type DeviceType = 'voiture' | 'linge' | 'eau' | 'vaisselle' | 'secheLinge' | 'froid' | 'utilitaire' | 'four';

export interface Device {
  name: string;
  detail: string;
  p: number;              // kW
  dur: number;            // créneaux de 30 min
  interruptible: boolean; // peut être coupé en plusieurs morceaux
  auto: boolean;          // true = pilotage automatique, false = rappel
  habitH: number;         // heure de lancement sans l'app
}

// Appareils (puissance en kW, durée en créneaux de 30 min) — repris de l'application de base.
export const DEVICES: Record<DeviceType, Device> = {
  voiture:    { name: 'Voiture électrique', detail: '+20 kWh (de 30 à 70 %)', p: 3.7, dur: 11, interruptible: true, auto: true, habitH: 18.5 },
  linge:      { name: 'Lave-linge', detail: 'Programme 40 °C', p: .8, dur: 3, interruptible: false, auto: false, habitH: 19 },
  eau:        { name: 'Chauffe-eau', detail: 'Ballon de 200 L', p: 2.4, dur: 4, interruptible: true, auto: true, habitH: 22 },
  vaisselle:  { name: 'Lave-vaisselle', detail: 'Programme éco', p: 1, dur: 3, interruptible: false, auto: false, habitH: 21 },
  secheLinge: { name: 'Sèche-linge', detail: 'Pompe à chaleur', p: 1, dur: 4, interruptible: false, auto: true, habitH: 19 },
  froid:      { name: 'Chambre froide', detail: 'Pré-refroidissement à -21 °C', p: 3, dur: 8, interruptible: true, auto: true, habitH: 16 },
  utilitaire: { name: 'Utilitaire de livraison', detail: '+30 kWh', p: 7, dur: 9, interruptible: true, auto: true, habitH: 13 },
  // AJOUT (absent de l'application de base) : valeurs d'hypothèse à valider avec l'équipe.
  four:       { name: 'Fours à pain', detail: 'Montée en température avant la cuisson', p: 12, dur: 4, interruptible: false, auto: true, habitH: 2 },
};

export interface UserTask extends Task {
  id: number;
  type: DeviceType;
  deadlineH: number;
  name: string;
  detail: string;
  auto: boolean;
}

let uid = 0;
export function mkTask(type: DeviceType, deadlineH: number): UserTask {
  const d = DEVICES[type];
  return { id: ++uid, type, ...d, deadlineH, deadline: slotOfHour(deadlineH) || SLOTS, habit: slotOfHour(d.habitH) };
}

export interface UserProfile {
  name: string;
  role: string;
  share: number; // part du soleil du quartier réservée (kWc équivalent)
  base: number;  // consommation de fond (kW)
  cap: number;   // puissance de l'abonnement (kW)
  tasks: UserTask[];
  types: DeviceType[];
}

export type ProfileId = 'ines' | 'inesGratuit' | 'karim' | 'karimPro';

// ines et karim : identiques à l'application de base (servent aussi aux tests de non-régression).
// inesGratuit et karimPro : variantes ajoutées pour les espaces Gratuit et Entreprise.
export function makeProfiles(): Record<ProfileId, UserProfile> {
  return {
    ines: { name: 'Inès', role: 'Habitante · offre Premium', share: 3, base: .5, cap: 6,
      tasks: [mkTask('voiture', 7), mkTask('linge', 22), mkTask('eau', 7), mkTask('vaisselle', 8)],
      types: ['voiture', 'linge', 'eau', 'vaisselle', 'secheLinge'] },
    inesGratuit: { name: 'Inès', role: 'Habitante · offre Gratuite', share: 3, base: .5, cap: 6,
      tasks: [mkTask('linge', 22), mkTask('eau', 7), mkTask('vaisselle', 8)],
      types: ['linge', 'eau', 'vaisselle', 'secheLinge'] },
    karim: { name: 'Karim', role: 'Boulangerie · offre Pro', share: 10, base: 4, cap: 30,
      tasks: [mkTask('froid', 18), mkTask('utilitaire', 5), mkTask('eau', 4), mkTask('vaisselle', 20)],
      types: ['froid', 'utilitaire', 'eau', 'vaisselle'] },
    karimPro: { name: 'Karim', role: 'Boulangerie · offre Entreprise', share: 10, base: 4, cap: 30,
      tasks: [mkTask('four', 4), mkTask('froid', 18), mkTask('utilitaire', 5), mkTask('eau', 4), mkTask('vaisselle', 20)],
      types: ['four', 'froid', 'utilitaire', 'eau', 'vaisselle'] },
  };
}

export const DEADLINES = [10, 12, 14, 16, 18, 20, 22, 0, 2, 4, 6, 7, 8];
export const deadlineText = (h: number) => {
  const s = slotOfHour(h);
  return 'Avant ' + h + 'h' + ((s >= 32 || s === 0) ? ' demain' : '');
};

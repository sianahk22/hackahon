import type { Category, ProfileKind } from './types';

// Catégories proposées par défaut. Liste ouverte : chaque compte peut en ajouter.
const sys = (id: string, name: string, icon: string, group: string): Category => ({ id, ownerId: 'system', name, icon, group });

export const SYSTEM_CATEGORIES: Record<ProfileKind, Category[]> = {
  particulier: [
    sys('p-lavage', 'Lavage', 'local_laundry_service', 'Lavage'),
    sys('p-vaisselle', 'Lave-vaisselle', 'dishwasher_gen', 'Électroménager'),
    sys('p-eau', 'Eau chaude', 'water_heater', 'Chauffage'),
    sys('p-chauffage', 'Chauffage', 'heat', 'Chauffage'),
    sys('p-vehicule', 'Véhicule électrique', 'ev_station', 'Véhicule'),
    sys('p-cuisson', 'Cuisson', 'microwave', 'Électroménager'),
    sys('p-autre', 'Autre appareil', 'devices_other', 'Électroménager'),
  ],
  entreprise: [
    sys('e-bureaux', 'Bureaux et bâtiments', 'apartment', 'Bâtiments'),
    sys('e-cvc', 'Chauffage et climatisation', 'hvac', 'Bâtiments'),
    sys('e-eclairage', 'Éclairage', 'lightbulb', 'Bâtiments'),
    sys('e-informatique', 'Informatique', 'dns', 'Équipements'),
    sys('e-machines', 'Machines industrielles', 'precision_manufacturing', 'Production'),
    sys('e-technique', 'Installations techniques', 'settings_input_component', 'Technique'),
    sys('e-alim', 'Production / alimentation électrique', 'electrical_services', 'Technique'),
    sys('e-vehicules', 'Véhicules et bornes', 'ev_station', 'Mobilité'),
    sys('e-autre', 'Autre équipement', 'devices_other', 'Autres'),
  ],
  collectivite: [
    sys('c-eclairage', 'Éclairage public', 'emoji_objects', 'Voirie'),
    sys('c-admin', 'Bâtiments administratifs', 'account_balance', 'Bâtiments'),
    sys('c-ecoles', 'Écoles', 'school', 'Bâtiments'),
    sys('c-sport', 'Gymnases et installations sportives', 'sports_gymnastics', 'Bâtiments'),
    sys('c-cvc', 'Chauffage et climatisation', 'hvac', 'Bâtiments'),
    sys('c-groupes', 'Groupes électrogènes', 'electric_bolt', 'Secours'),
    sys('c-pompes', 'Pompes et installations techniques', 'water_pump', 'Technique'),
    sys('c-bornes', 'Bornes de recharge', 'ev_station', 'Mobilité'),
    sys('c-autre', 'Autre équipement municipal', 'devices_other', 'Autres'),
  ],
};

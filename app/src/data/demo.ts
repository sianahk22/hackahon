// JEU DE DÉMONSTRATION — désactivé par défaut, chargé uniquement à la demande.
// Tout est marqué origin/source = 'demo' et signalé à l'écran par un bandeau.
// Aucun personnage, aucune coordonnée inventée : les bâtiments de démonstration
// ne sont pas localisés ; on les place sur la vraie carte pendant la démo.
import type { Building, Device, ProfileKind, Reading, Site, Zone } from '../core/types';
import { uid } from './repo/backend';

const H = 3600e3;
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

type Shape = (hourParis: number, dow: number) => number; // part de la puissance utilisée sur l'heure
const SHAPES: Record<string, Shape> = {
  soir: h => (h >= 18 && h < 23 ? .6 : h >= 7 && h < 9 ? .3 : .05),
  nuit: h => (h >= 22 || h < 6 ? .7 : .05),
  bureau: (h, d) => (d < 5 && h >= 8 && h < 19 ? .8 : .15),
  continu: () => .55,
  eclairage: h => (h >= 18 || h < 7 ? .95 : 0),
  ecole: (h, d) => (d < 5 && h >= 7 && h < 18 ? .75 : .1),
  sport: (h, d) => (h >= 9 && h < 22 ? (d >= 5 ? .8 : .6) : .05),
};

function parisHour(t: number) { return +new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)); }
function parisDow(t: number) { return (new Date(new Date(t).toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getDay() + 6) % 7; }

function readings(owner: string, d: Device, shape: Shape, days: number, seed: number): Reading[] {
  const r = rng(seed), out: Reading[] = [];
  const end = Math.floor(Date.now() / H) * H - H;
  const imported = new Date().toISOString();
  for (let t = end - days * 24 * H; t < end; t += H) {
    const kWh = Math.max(0, (d.powerKw ?? 1) * shape(parisHour(t), parisDow(t)) * (.75 + r() * .5));
    out.push({ id: uid(), ownerId: owner, deviceId: d.id, start: new Date(t).toISOString(), end: new Date(t + H).toISOString(), kWh: Math.round(kWh * 1000) / 1000, source: 'demo', importedAt: imported });
  }
  return out;
}

function dev(owner: string, name: string, categoryId: string, powerKw: number, extra: Partial<Device> = {}): Device {
  return {
    id: uid(), ownerId: owner, name, categoryId, powerKw, cycleMinutes: 60, interruptible: false, essential: false, critical: false,
    constraints: {}, connection: { status: 'non_connecte' }, control: { compatible: false, authorized: false, automation: false },
    origin: 'demo', createdAt: new Date().toISOString(), ...extra,
  };
}

export interface DemoSet { devices: Device[]; readings: Reading[]; sites: Site[]; zones: Zone[]; buildings: Building[] }

export function buildDemo(profile: ProfileKind, owner: string): DemoSet {
  const set: DemoSet = { devices: [], readings: [], sites: [], zones: [], buildings: [] };
  const add = (d: Device, shape: Shape, seed: number) => { set.devices.push(d); set.readings.push(...readings(owner, d, shape, 30, seed)); };

  if (profile === 'particulier') {
    add(dev(owner, 'Lave-linge', 'p-lavage', .8, { cycleMinutes: 90, constraints: { deadlineHour: 22, habitHour: 19 } }), SHAPES.soir, 1);
    add(dev(owner, 'Chauffe-eau 200 L', 'p-eau', 2.4, { cycleMinutes: 120, interruptible: true, constraints: { deadlineHour: 7, habitHour: 22 } }), SHAPES.nuit, 2);
    add(dev(owner, 'Lave-vaisselle', 'p-vaisselle', 1, { cycleMinutes: 90, constraints: { deadlineHour: 8, habitHour: 21 } }), SHAPES.soir, 3);
    add(dev(owner, 'Réfrigérateur', 'p-autre', .1, { essential: true }), SHAPES.continu, 4);
    return set;
  }

  if (profile === 'entreprise') {
    const s1: Site = { id: uid(), ownerId: owner, name: 'Site principal', origin: 'demo' };
    const s2: Site = { id: uid(), ownerId: owner, name: 'Entrepôt', origin: 'demo' };
    const zA: Zone = { id: uid(), ownerId: owner, name: 'Plateau bureaux', kind: 'zone', origin: 'demo' };
    const zB: Zone = { id: uid(), ownerId: owner, name: 'Atelier', kind: 'zone', origin: 'demo' };
    const b1: Building = { id: uid(), ownerId: owner, name: 'Bâtiment A', siteId: s1.id, zoneId: zA.id, origin: 'demo' };
    const b2: Building = { id: uid(), ownerId: owner, name: 'Bâtiment B', siteId: s1.id, zoneId: zB.id, origin: 'demo' };
    const b3: Building = { id: uid(), ownerId: owner, name: 'Hall de stockage', siteId: s2.id, origin: 'demo' };
    set.sites.push(s1, s2); set.zones.push(zA, zB); set.buildings.push(b1, b2, b3);
    const at = (b: Building) => ({ buildingId: b.id, siteId: b.siteId, zoneId: b.zoneId });
    add(dev(owner, 'Centrale de traitement d’air', 'e-cvc', 18, { ...at(b1), essential: true }), SHAPES.bureau, 11);
    add(dev(owner, 'Éclairage plateau', 'e-eclairage', 6, { ...at(b1), essential: true }), SHAPES.bureau, 12);
    add(dev(owner, 'Salle serveurs', 'e-informatique', 9, { ...at(b1), essential: true }), SHAPES.continu, 13);
    add(dev(owner, 'Compresseur d’air', 'e-machines', 22, { ...at(b2), cycleMinutes: 120 }), SHAPES.bureau, 14);
    add(dev(owner, 'Four de cuisson', 'e-machines', 30, { ...at(b2), cycleMinutes: 180, constraints: { deadlineHour: 6, habitHour: 3 } }), SHAPES.nuit, 15);
    add(dev(owner, 'Chambre froide (pré-refroidissement)', 'e-technique', 7, { ...at(b3), interruptible: true, cycleMinutes: 120, constraints: { deadlineHour: 18, habitHour: 15 } }), SHAPES.continu, 16);
    add(dev(owner, 'Bornes véhicules utilitaires', 'e-vehicules', 22, { ...at(b3), interruptible: true, cycleMinutes: 240, constraints: { deadlineHour: 6, habitHour: 18 } }), SHAPES.nuit, 17);
    add(dev(owner, 'Groupe électrogène de secours', 'e-alim', 60, { ...at(b3), critical: true, essential: true }), () => 0, 18);
    return set;
  }

  // Collectivité
  const zones = ['Quartier Nord', 'Centre-ville', 'Quartier Sud'].map(name => ({ id: uid(), ownerId: owner, name, kind: 'quartier' as const, origin: 'demo' as const }));
  set.zones.push(...zones);
  const bld = (name: string, z: Zone): Building => ({ id: uid(), ownerId: owner, name, zoneId: z.id, origin: 'demo' });
  const mairie = bld('Hôtel de ville', zones[1]), ecole = bld('Groupe scolaire', zones[0]), gym = bld('Gymnase municipal', zones[2]), ctm = bld('Centre technique municipal', zones[2]);
  set.buildings.push(mairie, ecole, gym, ctm);
  const at = (b: Building) => ({ buildingId: b.id, zoneId: b.zoneId });
  add(dev(owner, 'Chaufferie hôtel de ville', 'c-cvc', 40, at(mairie)), SHAPES.bureau, 21);
  add(dev(owner, 'Éclairage bureaux', 'c-admin', 8, at(mairie)), SHAPES.bureau, 22);
  add(dev(owner, 'Chauffage école', 'c-ecoles', 35, at(ecole)), SHAPES.ecole, 23);
  add(dev(owner, 'Cuisine de la cantine', 'c-ecoles', 25, { ...at(ecole), cycleMinutes: 120, constraints: { deadlineHour: 11, habitHour: 9 } }), SHAPES.ecole, 24);
  add(dev(owner, 'Éclairage du gymnase', 'c-sport', 12, at(gym)), SHAPES.sport, 25);
  add(dev(owner, 'Eau chaude des douches', 'c-sport', 18, { ...at(gym), interruptible: true, cycleMinutes: 180, constraints: { deadlineHour: 9, habitHour: 6 } }), SHAPES.nuit, 26);
  add(dev(owner, 'Pompe de relevage', 'c-pompes', 15, { ...at(ctm), essential: true }), SHAPES.continu, 27);
  add(dev(owner, 'Recharge des véhicules municipaux', 'c-bornes', 44, { ...at(ctm), interruptible: true, cycleMinutes: 300, constraints: { deadlineHour: 7, habitHour: 17 } }), SHAPES.nuit, 28);
  add(dev(owner, 'Groupe électrogène de secours', 'c-groupes', 100, { ...at(mairie), critical: true, essential: true }), () => 0, 29);
  add(dev(owner, 'Éclairage public — secteur Nord', 'c-eclairage', 30, { zoneId: zones[0].id }), SHAPES.eclairage, 30);
  add(dev(owner, 'Éclairage public — secteur Sud', 'c-eclairage', 26, { zoneId: zones[2].id }), SHAPES.eclairage, 31);
  return set;
}

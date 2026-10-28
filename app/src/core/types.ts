// Modèle de données commun aux trois profils (particulier, entreprise, collectivité).
// Toutes les entités appartiennent à un « propriétaire » (ownerId) : l'utilisateur
// pour un particulier, l'organisation pour une entreprise ou une collectivité.

export type ProfileKind = 'particulier' | 'entreprise' | 'collectivite';
export type Role = 'admin' | 'gestionnaire' | 'lecteur';

// Origine d'un enregistrement : jamais confondre une saisie, un import et la démo.
export type Origin = 'saisie' | 'import' | 'integration' | 'demo';

export interface Account {
  id: string;
  email?: string;
  displayName: string;
  profile?: ProfileKind;      // choisi à la première connexion
  orgId?: string;             // organisation (entreprise, collectivité)
}

export interface Organization {
  id: string;
  kind: 'entreprise' | 'collectivite';
  name: string;
  // Une collectivité n'a accès à l'espace municipal complet qu'après activation
  // administrative ou contractuelle. Jamais activée automatiquement en production.
  activation: { status: 'en_attente' | 'active'; by?: string; at?: string; note?: string };
  territory?: Territory;
}

export interface Membership { orgId: string; accountId: string; role: Role }

export interface Territory {
  codeInsee: string;          // identifiant officiel de la commune (geo.api.gouv.fr)
  nom: string;
  centre: [number, number];   // [longitude, latitude]
  contour?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface Site { id: string; ownerId: string; name: string; address?: string; origin: Origin }

export interface Zone { id: string; ownerId: string; name: string; kind: 'quartier' | 'zone'; origin: Origin }

export interface Building {
  id: string; ownerId: string; name: string;
  siteId?: string; zoneId?: string;
  lon?: number; lat?: number;
  banId?: string;             // identifiant Base Adresse Nationale (adresse officielle)
  address?: string;
  origin: Origin;
}

export interface Category { id: string; ownerId: string | 'system'; name: string; icon: string; group?: string }

export type ConnectionStatus = 'non_connecte' | 'connecte' | 'hors_ligne';

export interface Device {
  id: string; ownerId: string;
  name: string;
  categoryId: string;
  manufacturer?: string; model?: string; reference?: string;
  siteId?: string; buildingId?: string; zoneId?: string;
  lon?: number; lat?: number;
  powerKw?: number;           // puissance moyenne pendant un cycle
  cycleMinutes?: number;      // durée d'un cycle d'utilisation
  interruptible: boolean;     // peut être coupé en plusieurs morceaux
  essential: boolean;         // usage essentiel : on ne propose pas de le décaler
  critical: boolean;          // système critique (secours, sécurité) : jamais d'automatisme
  constraints: { earliestHour?: number; deadlineHour?: number; habitHour?: number };
  connection: { status: ConnectionStatus; integration?: string; lastSeen?: string };
  control: { compatible: boolean; authorized: boolean; automation: boolean };
  origin: Origin;
  createdAt: string;
}

// Mesure de consommation importée ou relevée. Une absence de mesure n'est jamais un zéro.
export interface Reading {
  id: string; ownerId: string;
  deviceId?: string;          // vide = compteur général
  start: string; end: string; // ISO 8601
  kWh: number;
  source: 'import_csv' | 'compteur' | 'integration' | 'demo';
  importedAt: string;
}

// Usage planifié : rappel (appareil non pilotable) ou commande (si intégration autorisée).
export interface Plan {
  id: string; ownerId: string; deviceId: string;
  start: string; end: string;
  mode: 'rappel' | 'commande';
  status: 'prevu' | 'fait' | 'annule';
  co2g?: number; costEur?: number;        // prévision au moment de la décision
  refCo2g?: number; refCostEur?: number;  // même usage à l'heure habituelle
  explanation: string;
  createdAt: string;
}

export interface AuditEntry { id: string; ownerId: string; at: string; actor: string; action: string; target?: string; result: 'ok' | 'refuse' | 'erreur'; detail?: string }

export type TariffKind = 'inconnu' | 'base' | 'hphc' | 'tempo';
export interface TariffSettings {
  kind: TariffKind;
  base?: number;                 // €/kWh TTC
  hp?: number; hc?: number;      // €/kWh TTC (option heures creuses)
  hcRanges?: [number, number][]; // plages d'heures creuses, ex. [[22, 6]]
}

export interface OwnerSettings { tariff: TariffSettings; offer?: 'gratuit' | 'connexion_pilotage' }

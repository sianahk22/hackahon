// Interface de stockage commune aux deux modes (local et Supabase).
// Chaque lecture et écriture est cloisonnée par propriétaire (ownerId) :
// un utilisateur pour un particulier, une organisation pour une entreprise ou une collectivité.
import type { Account, Membership, Organization, OwnerSettings } from '../../core/types';

export type Collection = 'devices' | 'categories' | 'sites' | 'zones' | 'buildings' | 'readings' | 'plans' | 'audit';
export interface Rec { id: string; ownerId: string; origin?: string }

export interface Backend {
  readonly mode: 'local' | 'supabase';
  // Comptes
  currentAccount(): Promise<Account | null>;
  signUp(email: string, password: string, displayName: string): Promise<Account>;
  signIn(email: string, password: string): Promise<Account>;
  signOut(): Promise<void>;
  saveAccount(a: Account): Promise<void>;
  // Organisations
  createOrg(o: Omit<Organization, 'id'>, owner: Account): Promise<Organization>;
  getOrg(id: string): Promise<Organization | null>;
  updateOrg(o: Organization): Promise<void>;
  membership(orgId: string, accountId: string): Promise<Membership | null>;
  members(orgId: string): Promise<(Membership & { displayName?: string; email?: string })[]>;
  // Données
  list<T extends Rec>(ownerId: string, c: Collection): Promise<T[]>;
  put<T extends Rec>(c: Collection, item: T): Promise<void>;
  putMany<T extends Rec>(c: Collection, items: T[]): Promise<void>;
  remove(ownerId: string, c: Collection, id: string): Promise<void>;
  removeWhere(ownerId: string, c: Collection, pred: { origin?: string; deviceId?: string }): Promise<void>;
  getSettings(ownerId: string): Promise<OwnerSettings>;
  saveSettings(ownerId: string, s: OwnerSettings): Promise<void>;
}

export const DEFAULT_SETTINGS: OwnerSettings = { tariff: { kind: 'inconnu' }, offer: 'gratuit' };
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

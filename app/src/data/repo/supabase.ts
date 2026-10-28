// Mode SUPABASE : comptes réels et isolation des données par les règles RLS du serveur.
// Activé seulement si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies (.env.local).
// La clé « anon » est publique par conception : la sécurité repose sur les règles RLS
// (supabase/migrations/0001_init.sql). La clé service_role ne doit JAMAIS être dans ce code.
// NON TESTÉ contre un vrai projet tant qu'aucun projet Supabase n'est configuré.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Account, Membership, Organization, OwnerSettings, ProfileKind, Role } from '../../core/types';
import { DEFAULT_SETTINGS, type Backend, type Collection, type Rec } from './backend';

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  constructor(url: string, anonKey: string) { this.sb = createClient(url, anonKey); }

  private check<T>(r: { data: T; error: { message: string } | null }): T {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  async currentAccount(): Promise<Account | null> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return null;
    const p = await this.sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    const row = this.check(p) as { display_name: string; profile: ProfileKind | null; org_id: string | null } | null;
    if (!row) return { id: data.user.id, email: data.user.email, displayName: data.user.email ?? 'Compte' };
    return { id: data.user.id, email: data.user.email, displayName: row.display_name, profile: row.profile ?? undefined, orgId: row.org_id ?? undefined };
  }
  async signUp(email: string, password: string, displayName: string) {
    const r = await this.sb.auth.signUp({ email, password });
    if (r.error) throw new Error(r.error.message);
    if (!r.data.user) throw new Error('Inscription incomplète.');
    if (!r.data.session) throw new Error('Vérifiez votre boîte mail pour confirmer l’inscription, puis connectez-vous.');
    const a: Account = { id: r.data.user.id, email, displayName };
    await this.saveAccount(a);
    return a;
  }
  async signIn(email: string, password: string) {
    const r = await this.sb.auth.signInWithPassword({ email, password });
    if (r.error) throw new Error(r.error.message);
    return (await this.currentAccount())!;
  }
  async signOut() { await this.sb.auth.signOut(); }
  async saveAccount(a: Account) {
    this.check(await this.sb.from('profiles').upsert({ id: a.id, display_name: a.displayName, profile: a.profile ?? null, org_id: a.orgId ?? null }));
  }

  async createOrg(o: Omit<Organization, 'id'>) {
    const row = this.check(await this.sb.from('organizations').insert({ kind: o.kind, name: o.name, territory: o.territory ?? null }).select().single()) as { id: string };
    return (await this.getOrg(row.id))!;
  }
  async getOrg(id: string): Promise<Organization | null> {
    const o = this.check(await this.sb.from('organizations').select('*, activations(*)').eq('id', id).maybeSingle()) as
      { id: string; kind: Organization['kind']; name: string; territory: Organization['territory'] | null; activations: { status: 'en_attente' | 'active'; activated_by?: string; activated_at?: string; note?: string } | null } | null;
    if (!o) return null;
    const act = o.activations;
    return {
      id: o.id, kind: o.kind, name: o.name, territory: o.territory ?? undefined,
      activation: o.kind === 'entreprise' ? { status: 'active' } : { status: act?.status ?? 'en_attente', by: act?.activated_by, at: act?.activated_at, note: act?.note },
    };
  }
  async updateOrg(o: Organization) {
    // L'activation n'est pas modifiable ici (pas de règle d'écriture côté serveur).
    this.check(await this.sb.from('organizations').update({ name: o.name, territory: o.territory ?? null }).eq('id', o.id));
  }
  async membership(orgId: string, accountId: string): Promise<Membership | null> {
    const m = this.check(await this.sb.from('memberships').select('*').eq('org_id', orgId).eq('account_id', accountId).maybeSingle()) as { role: Role } | null;
    return m ? { orgId, accountId, role: m.role } : null;
  }
  async members(orgId: string) {
    const rows = this.check(await this.sb.from('memberships').select('account_id, role').eq('org_id', orgId)) as { account_id: string; role: Role }[];
    return rows.map(r => ({ orgId, accountId: r.account_id, role: r.role }));
  }

  async list<T extends Rec>(ownerId: string, c: Collection) {
    const rows = this.check(await this.sb.from('records').select('data').eq('owner_id', ownerId).eq('collection', c)) as { data: T }[];
    return rows.map(r => r.data);
  }
  async put<T extends Rec>(c: Collection, item: T) { await this.putMany(c, [item]); }
  async putMany<T extends Rec>(c: Collection, items: T[]) {
    for (let k = 0; k < items.length; k += 500) {
      const chunk = items.slice(k, k + 500).map(i => ({ owner_id: i.ownerId, collection: c, id: i.id, origin: i.origin ?? (i as { source?: string }).source ?? null, data: i, updated_at: new Date().toISOString() }));
      this.check(await this.sb.from('records').upsert(chunk));
    }
  }
  async remove(ownerId: string, c: Collection, id: string) {
    this.check(await this.sb.from('records').delete().eq('owner_id', ownerId).eq('collection', c).eq('id', id));
  }
  async removeWhere(ownerId: string, c: Collection, pred: { origin?: string; deviceId?: string }) {
    let q = this.sb.from('records').delete().eq('owner_id', ownerId).eq('collection', c);
    if (pred.origin) q = q.eq('origin', pred.origin);
    if (pred.deviceId) q = q.eq('data->>deviceId', pred.deviceId);
    this.check(await q);
  }
  async getSettings(ownerId: string): Promise<OwnerSettings> {
    const r = this.check(await this.sb.from('settings').select('data').eq('owner_id', ownerId).maybeSingle()) as { data: OwnerSettings } | null;
    return r?.data ?? DEFAULT_SETTINGS;
  }
  async saveSettings(ownerId: string, s: OwnerSettings) {
    this.check(await this.sb.from('settings').upsert({ owner_id: ownerId, data: s }));
  }
}

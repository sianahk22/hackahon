// Mode LOCAL : les données restent dans ce navigateur (localStorage).
// Aucune sécurité réelle : pas de mot de passe vérifié par un serveur, données lisibles
// par quiconque utilise ce navigateur. Réservé au développement et à la démonstration.
import type { Account, Membership, Organization, OwnerSettings } from '../../core/types';
import { DEFAULT_SETTINGS, uid, type Backend, type Collection, type Rec } from './backend';

export class MemoryStorage { private m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeStorage(): Storage {
  try { const s = window.localStorage; s.setItem('lbm:test', '1'); s.removeItem('lbm:test'); return s; } catch { return new MemoryStorage(); }
}

export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  constructor(private s: Storage = safeStorage()) {}

  private read<T>(k: string, def: T): T { try { const v = this.s.getItem(k); return v ? JSON.parse(v) as T : def; } catch { return def; } }
  private write(k: string, v: unknown) { this.s.setItem(k, JSON.stringify(v)); }
  private key(owner: string, c: Collection) { return `lbm:data:${owner}:${c}`; }

  async currentAccount() { return this.read<Account | null>('lbm:account', null); }
  async signUp(_email: string, _password: string, displayName: string) {
    // Mode local : pas de mot de passe stocké ni vérifié.
    const a: Account = { id: uid(), displayName };
    this.write('lbm:account', a); return a;
  }
  async signIn(): Promise<Account> { throw new Error('En mode local, créez un compte local.'); }
  async signOut() { this.s.removeItem('lbm:account'); }
  async saveAccount(a: Account) { this.write('lbm:account', a); }

  async createOrg(o: Omit<Organization, 'id'>, owner: Account) {
    const org: Organization = { ...o, id: uid() };
    this.write(`lbm:org:${org.id}`, org);
    this.write(`lbm:members:${org.id}`, [{ orgId: org.id, accountId: owner.id, role: 'admin' } satisfies Membership]);
    return org;
  }
  async getOrg(id: string) { return this.read<Organization | null>(`lbm:org:${id}`, null); }
  async updateOrg(o: Organization) { this.write(`lbm:org:${o.id}`, o); }
  async membership(orgId: string, accountId: string) { return this.read<Membership[]>(`lbm:members:${orgId}`, []).find(m => m.accountId === accountId) ?? null; }
  async members(orgId: string) { return this.read<Membership[]>(`lbm:members:${orgId}`, []); }

  async list<T extends Rec>(ownerId: string, c: Collection) { return this.read<T[]>(this.key(ownerId, c), []); }
  async put<T extends Rec>(c: Collection, item: T) { await this.putMany(c, [item]); }
  async putMany<T extends Rec>(c: Collection, items: T[]) {
    const byOwner = new Map<string, T[]>();
    items.forEach(i => byOwner.set(i.ownerId, [...(byOwner.get(i.ownerId) ?? []), i]));
    for (const [owner, its] of byOwner) {
      const cur = await this.list<T>(owner, c);
      const ids = new Set(its.map(i => i.id));
      this.write(this.key(owner, c), [...cur.filter(x => !ids.has(x.id)), ...its]);
    }
  }
  async remove(ownerId: string, c: Collection, id: string) {
    this.write(this.key(ownerId, c), (await this.list(ownerId, c)).filter(x => x.id !== id));
  }
  async removeWhere(ownerId: string, c: Collection, pred: { origin?: string; deviceId?: string }) {
    const cur = await this.list<Rec & { deviceId?: string; source?: string }>(ownerId, c);
    this.write(this.key(ownerId, c), cur.filter(x =>
      !((pred.origin === undefined || x.origin === pred.origin || x.source === pred.origin) && (pred.deviceId === undefined || x.deviceId === pred.deviceId))));
  }
  async getSettings(ownerId: string) { return this.read<OwnerSettings>(`lbm:settings:${ownerId}`, DEFAULT_SETTINGS); }
  async saveSettings(ownerId: string, s: OwnerSettings) { this.write(`lbm:settings:${ownerId}`, s); }
}

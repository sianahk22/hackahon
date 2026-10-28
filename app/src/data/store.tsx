// Magasin central : compte, organisation, données du propriétaire et sources réelles.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CarbonModel } from '../core/carbon';
import { SYSTEM_CATEGORIES } from '../core/categories';
import type { TempoColor } from '../core/tariffs';
import type { Account, AuditEntry, Building, Category, Device, Organization, OwnerSettings, Plan, ProfileKind, Reading, Role, Site, Zone } from '../core/types';
import { createBackend, DEFAULT_SETTINGS, uid, type Collection, type Rec } from './repo';
import { buildDemo } from './demo';
import { fetchCarbon, fetchTempoColors } from './sources/public';

type Load<T> = { status: 'chargement' | 'ok' | 'erreur'; value?: T; error?: string; at?: string };

export interface Data { devices: Device[]; customCategories: Category[]; sites: Site[]; zones: Zone[]; buildings: Building[]; readings: Reading[]; plans: Plan[]; audit: AuditEntry[] }
const EMPTY: Data = { devices: [], customCategories: [], sites: [], zones: [], buildings: [], readings: [], plans: [], audit: [] };
const KEYS: Record<keyof Data, Collection> = { devices: 'devices', customCategories: 'categories', sites: 'sites', zones: 'zones', buildings: 'buildings', readings: 'readings', plans: 'plans', audit: 'audit' };

const backend = createBackend();

function useStoreValue() {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [role, setRole] = useState<Role>('admin');
  const [data, setData] = useState<Data>(EMPTY);
  const [settings, setSettings] = useState<OwnerSettings>(DEFAULT_SETTINGS);
  const [carbon, setCarbon] = useState<Load<CarbonModel>>({ status: 'chargement' });
  const [tempo, setTempo] = useState<Load<Record<string, TempoColor>>>({ status: 'chargement' });

  const ownerId = account ? (account.orgId ?? account.id) : '';
  const profile = account?.profile;

  // Sources publiques réelles
  const refreshSources = useCallback(async () => {
    setCarbon(c => ({ ...c, status: 'chargement' }));
    try { setCarbon({ status: 'ok', value: new CarbonModel(await fetchCarbon(8)), at: new Date().toISOString() }); }
    catch (e) { setCarbon({ status: 'erreur', error: e instanceof Error ? e.message : String(e), value: new CarbonModel([]) }); }
    try { setTempo({ status: 'ok', value: await fetchTempoColors(), at: new Date().toISOString() }); }
    catch (e) { setTempo({ status: 'erreur', error: String(e), value: {} }); }
  }, []);
  useEffect(() => { refreshSources(); const t = setInterval(refreshSources, 15 * 60e3); return () => clearInterval(t); }, [refreshSources]);

  const loadOwner = useCallback(async (a: Account | null) => {
    setAccount(a);
    if (!a) { setOrg(null); setData(EMPTY); return; }
    const owner = a.orgId ?? a.id;
    if (a.orgId) {
      setOrg(await backend.getOrg(a.orgId));
      setRole((await backend.membership(a.orgId, a.id))?.role ?? 'lecteur');
    } else { setOrg(null); setRole('admin'); }
    const entries = await Promise.all((Object.keys(KEYS) as (keyof Data)[]).map(async k => [k, await backend.list(owner, KEYS[k])] as const));
    setData(Object.fromEntries(entries) as unknown as Data);
    setSettings(await backend.getSettings(owner));
  }, []);

  useEffect(() => { backend.currentAccount().then(loadOwner).catch(() => loadOwner(null)).finally(() => setReady(true)); }, [loadOwner]);

  const reload = useCallback(() => loadOwner(account), [account, loadOwner]);

  const categories = useMemo(() => [...(profile ? SYSTEM_CATEGORIES[profile] : []), ...data.customCategories], [profile, data.customCategories]);

  // ---------- Actions ----------
  const log = useCallback(async (action: string, result: AuditEntry['result'], target?: string, detail?: string) => {
    if (!account) return;
    const e: AuditEntry = { id: uid(), ownerId, at: new Date().toISOString(), actor: account.displayName, action, target, result, detail };
    await backend.put('audit', e);
    setData(d => ({ ...d, audit: [e, ...d.audit] }));
  }, [account, ownerId]);

  const upsert = useCallback(async <K extends keyof Data>(k: K, item: Data[K][number] & Rec) => {
    await backend.put(KEYS[k], item);
    setData(d => ({ ...d, [k]: [...(d[k] as Rec[]).filter(x => x.id !== item.id), item] }));
  }, []);

  const remove = useCallback(async (k: keyof Data, id: string) => {
    await backend.remove(ownerId, KEYS[k], id);
    setData(d => ({ ...d, [k]: (d[k] as Rec[]).filter(x => x.id !== id) }));
  }, [ownerId]);

  const importReadings = useCallback(async (rows: { start: string; end: string; kWh: number }[], deviceId?: string) => {
    const at = new Date().toISOString();
    const items: Reading[] = rows.map(r => ({ id: uid(), ownerId, deviceId, ...r, source: 'import_csv', importedAt: at }));
    await backend.putMany('readings', items);
    setData(d => ({ ...d, readings: [...d.readings, ...items] }));
    await log('Import de relevés', 'ok', deviceId, `${items.length} lignes`);
  }, [ownerId, log]);

  const saveSettings = useCallback(async (s: OwnerSettings) => { await backend.saveSettings(ownerId, s); setSettings(s); }, [ownerId]);

  const signUp = useCallback(async (email: string, password: string, name: string) => loadOwner(await backend.signUp(email, password, name)), [loadOwner]);
  const signIn = useCallback(async (email: string, password: string) => loadOwner(await backend.signIn(email, password)), [loadOwner]);
  const signOut = useCallback(async () => { await backend.signOut(); await loadOwner(null); }, [loadOwner]);

  const chooseProfile = useCallback(async (kind: ProfileKind, orgName?: string) => {
    if (!account) return;
    let next: Account = { ...account, profile: kind, orgId: undefined };
    if (kind !== 'particulier') {
      const o = await backend.createOrg({ kind, name: orgName!, activation: kind === 'entreprise' ? { status: 'active' } : { status: 'en_attente' } }, account);
      next = { ...next, orgId: o.id };
    }
    await backend.saveAccount(next);
    await loadOwner(next);
  }, [account, loadOwner]);

  // Changement de type de compte : seulement pour un particulier sans organisation (l'écran vérifie l'absence de données).
  const resetProfile = useCallback(async () => {
    if (!account || account.orgId) return;
    const next: Account = { ...account, profile: undefined };
    await backend.saveAccount(next); await loadOwner(next);
  }, [account, loadOwner]);

  const listMembers = useCallback(async () => (org ? backend.members(org.id) : []), [org]);

  const updateOrg = useCallback(async (o: Organization) => { await backend.updateOrg(o); setOrg(o); }, []);

  // Mode local uniquement : activation de test, sans valeur contractuelle.
  const activateLocally = useCallback(async () => {
    if (!org || backend.mode !== 'local') return;
    const o: Organization = { ...org, activation: { status: 'active', by: account?.displayName, at: new Date().toISOString(), note: 'Activation locale de test — sans valeur administrative ni contractuelle' } };
    await backend.updateOrg(o); setOrg(o);
    await log('Activation locale de l’espace municipal', 'ok');
  }, [org, account, log]);

  const hasDemo = data.devices.some(d => d.origin === 'demo') || data.readings.some(r => r.source === 'demo');

  const loadDemo = useCallback(async () => {
    if (!profile) return;
    const set = buildDemo(profile, ownerId);
    await backend.putMany('sites', set.sites); await backend.putMany('zones', set.zones); await backend.putMany('buildings', set.buildings);
    await backend.putMany('devices', set.devices); await backend.putMany('readings', set.readings);
    await reload();
    await log('Chargement du jeu de démonstration', 'ok');
  }, [profile, ownerId, reload, log]);

  const clearDemo = useCallback(async () => {
    for (const c of ['devices', 'sites', 'zones', 'buildings'] as Collection[]) await backend.removeWhere(ownerId, c, { origin: 'demo' });
    await backend.removeWhere(ownerId, 'readings', { origin: 'demo' });
    const demoIds = new Set(data.devices.filter(d => d.origin === 'demo').map(d => d.id));
    for (const p of data.plans.filter(p => demoIds.has(p.deviceId))) await backend.remove(ownerId, 'plans', p.id);
    await reload();
    await log('Suppression du jeu de démonstration', 'ok');
  }, [ownerId, data.devices, data.plans, reload, log]);

  return {
    ready, mode: backend.mode, account, org, role, ownerId, profile, data, categories, settings, carbon, tempo, hasDemo,
    refreshSources, upsert, remove, importReadings, saveSettings, signUp, signIn, signOut, chooseProfile, resetProfile, listMembers, updateOrg, activateLocally, loadDemo, clearDemo, log,
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) { return <Ctx.Provider value={useStoreValue()}>{children}</Ctx.Provider>; }
export function useStore() { const s = useContext(Ctx); if (!s) throw new Error('StoreProvider manquant'); return s; }

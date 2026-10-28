// Ajout, modification et fiche détaillée d'un équipement (commun aux trois profils).
import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { uid } from '../data/repo';
import type { Category, Device } from '../core/types';
import { checkCommand } from '../core/permissions';
import { COMMAND_INTEGRATION_READY, INTEGRATIONS } from '../core/integrations';
import { parseReadingsCsv, toCsv, download } from '../core/csv';
import { total } from '../core/stats';
import { DatumBadge, EmptyState, Icon, Missing, Modal, fmt } from '../ui/ui';
import { useRecommendations } from './reco';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourOpt = (h: number) => <option key={h} value={h}>{h} h</option>;

export function categoryOf(cats: Category[], id: string) { return cats.find(c => c.id === id); }

// ---------- Choix du mode d'ajout ----------
export function AddDeviceFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'choix' | 'manuel' | 'integration'>('choix');
  if (step === 'manuel') return <DeviceForm onClose={onClose} />;
  return (
    <Modal title={step === 'choix' ? 'Ajouter un équipement' : 'Intégrations disponibles'} onClose={onClose}>
      {step === 'choix' ? (
        <div className="stack">
          <p className="small muted">Choisissez comment ajouter cet équipement.</p>
          <button type="button" className="card bordered row" style={{ textAlign: 'left', cursor: 'pointer', gap: 14 }} onClick={() => setStep('manuel')}>
            <Icon name="edit_note" size={24} /><span style={{ display: 'grid' }}><strong style={{ fontWeight: 500 }}>Ajout manuel</strong><span className="small muted">Vous renseignez ses caractéristiques. Recommandations et rappels disponibles.</span></span>
          </button>
          <button type="button" className="card bordered row" style={{ textAlign: 'left', cursor: 'pointer', gap: 14 }} onClick={() => setStep('integration')}>
            <Icon name="wifi" size={24} /><span style={{ display: 'grid' }}><strong style={{ fontWeight: 500 }}>Connexion automatique</strong><span className="small muted">Compteur Linky, appareils connectés, gestion technique du bâtiment.</span></span>
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="small muted">Aucune intégration d’appareil n’est encore configurée : la détection automatique n’est donc pas disponible. Voici ce que chaque connexion nécessite.</p>
          {INTEGRATIONS.filter(i => !['eco2mix', 'tempo'].includes(i.id)).map(i => (
            <div key={i.id} className="card bordered stack" style={{ gap: 6 }}>
              <div className="between"><strong style={{ fontWeight: 500 }}>{i.name}</strong><span className="pill ghost">{i.status === 'non_configuree' ? 'Non configurée' : 'À développer'}</span></div>
              <span className="small"><b style={{ fontWeight: 500 }}>Données :</b> {i.data} · {i.frequency}</span>
              <span className="small"><b style={{ fontWeight: 500 }}>Commandes :</b> {i.commands}</span>
              <span className="small muted"><b style={{ fontWeight: 500 }}>Prérequis :</b> {i.prerequisite}</span>
            </div>
          ))}
          <button type="button" className="btn soft" onClick={() => setStep('manuel')}>Ajouter manuellement en attendant</button>
        </div>
      )}
    </Modal>
  );
}

// ---------- Formulaire ----------
export function DeviceForm({ device, onClose, preset }: { device?: Device; onClose: () => void; preset?: Partial<Device> }) {
  const s = useStore();
  const org = s.profile !== 'particulier';
  const [d, setD] = useState<Device>(device ?? {
    id: uid(), ownerId: s.ownerId, name: '', categoryId: s.categories[0]?.id ?? '', interruptible: false, essential: false, critical: false,
    constraints: {}, connection: { status: 'non_connecte' }, control: { compatible: false, authorized: false, automation: false },
    origin: 'saisie', createdAt: new Date().toISOString(), ...preset,
  });
  const [newCat, setNewCat] = useState(''), [err, setErr] = useState('');
  const set = (p: Partial<Device>) => setD(x => ({ ...x, ...p }));
  const setC = (k: keyof Device['constraints'], v: string) => setD(x => ({ ...x, constraints: { ...x.constraints, [k]: v === '' ? undefined : +v } }));
  const numOrUndef = (v: string) => (v === '' ? undefined : Math.max(0, +v.replace(',', '.')));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (d.name.trim().length < 2) return setErr('Indiquez un nom.');
    let categoryId = d.categoryId;
    if (categoryId === '__new') {
      if (newCat.trim().length < 2) return setErr('Indiquez le nom de la nouvelle catégorie.');
      const c: Category = { id: uid(), ownerId: s.ownerId, name: newCat.trim(), icon: 'devices_other' };
      await s.upsert('customCategories', c); categoryId = c.id;
    }
    const b = s.data.buildings.find(x => x.id === d.buildingId);
    const next: Device = { ...d, name: d.name.trim(), categoryId, siteId: d.siteId ?? b?.siteId, zoneId: d.zoneId ?? b?.zoneId,
      // Un système critique n'est jamais automatisé.
      control: d.critical ? { ...d.control, automation: false } : d.control };
    await s.upsert('devices', next);
    await s.log(device ? 'Modification d’équipement' : 'Ajout d’équipement', 'ok', next.name);
    onClose();
  };

  return (
    <Modal title={device ? 'Modifier l’équipement' : 'Nouvel équipement'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span>Nom</span><input className="input" required value={d.name} onChange={e => set({ name: e.target.value })} /></label>
          <label className="field"><span>Catégorie</span>
            <select value={d.categoryId} onChange={e => set({ categoryId: e.target.value })}>
              {s.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">+ Nouvelle catégorie…</option>
            </select>
          </label>
          {d.categoryId === '__new' && <label className="field"><span>Nom de la catégorie</span><input className="input" value={newCat} onChange={e => setNewCat(e.target.value)} /></label>}
          <label className="field"><span>Fabricant (facultatif)</span><input className="input" value={d.manufacturer ?? ''} onChange={e => set({ manufacturer: e.target.value || undefined })} /></label>
          <label className="field"><span>Modèle (facultatif)</span><input className="input" value={d.model ?? ''} onChange={e => set({ model: e.target.value || undefined })} /></label>
          <label className="field"><span>Puissance moyenne (kW)</span><input className="input" inputMode="decimal" value={d.powerKw ?? ''} onChange={e => set({ powerKw: numOrUndef(e.target.value) })} placeholder="ex. 0,8" /></label>
          <label className="field"><span>Durée d’un cycle (minutes)</span><input className="input" inputMode="numeric" value={d.cycleMinutes ?? ''} onChange={e => set({ cycleMinutes: numOrUndef(e.target.value) })} placeholder="ex. 90" /></label>
        </div>

        {org && (
          <div className="form-grid">
            {s.data.sites.length > 0 && <label className="field"><span>Site</span><select value={d.siteId ?? ''} onChange={e => set({ siteId: e.target.value || undefined })}><option value="">—</option>{s.data.sites.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
            <label className="field"><span>Bâtiment</span><select value={d.buildingId ?? ''} onChange={e => set({ buildingId: e.target.value || undefined })}><option value="">—</option>{s.data.buildings.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="field"><span>{s.profile === 'collectivite' ? 'Quartier / zone' : 'Zone'}</span><select value={d.zoneId ?? ''} onChange={e => set({ zoneId: e.target.value || undefined })}><option value="">—</option>{s.data.zones.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </div>
        )}

        <fieldset className="card soft stack" style={{ border: 0, margin: 0 }}>
          <legend className="eyebrow" style={{ padding: 0 }}>Contraintes d’utilisation (heure de Paris)</legend>
          <div className="form-grid">
            <label className="field"><span>Pas avant</span><select value={d.constraints.earliestHour ?? ''} onChange={e => setC('earliestHour', e.target.value)}><option value="">Dès maintenant</option>{HOURS.map(hourOpt)}</select></label>
            <label className="field"><span>Terminé avant (échéance)</span><select value={d.constraints.deadlineHour ?? ''} onChange={e => setC('deadlineHour', e.target.value)}><option value="">Dans les 24 h</option>{HOURS.map(hourOpt)}</select></label>
            <label className="field"><span>Heure habituelle de lancement</span><select value={d.constraints.habitHour ?? ''} onChange={e => setC('habitHour', e.target.value)}><option value="">Non renseignée</option>{HOURS.map(hourOpt)}</select></label>
          </div>
          <span className="xs muted">L’heure habituelle sert à comparer : sans elle, aucun gain ne peut être estimé.</span>
          <label className="check"><input type="checkbox" checked={d.interruptible} onChange={e => set({ interruptible: e.target.checked })} /><span>Peut être interrompu puis repris (ex. chauffe-eau, recharge)</span></label>
          <label className="check"><input type="checkbox" checked={d.essential} onChange={e => set({ essential: e.target.checked })} /><span>Usage essentiel : ne jamais proposer de le décaler</span></label>
          {org && <label className="check"><input type="checkbox" checked={d.critical} onChange={e => set({ critical: e.target.checked })} /><span>Système critique (secours, sécurité) : aucune automatisation</span></label>}
        </fieldset>

        <fieldset className="card soft stack" style={{ border: 0, margin: 0 }}>
          <legend className="eyebrow" style={{ padding: 0 }}>Pilotage</legend>
          <label className="check"><input type="checkbox" checked={d.control.compatible} onChange={e => set({ control: { ...d.control, compatible: e.target.checked } })} /><span>Appareil déclaré compatible avec le pilotage à distance</span></label>
          <label className="check"><input type="checkbox" checked={d.control.authorized} disabled={d.critical} onChange={e => set({ control: { ...d.control, authorized: e.target.checked } })} /><span>J’autorise Le Bon Moment à le piloter quand une intégration sera disponible</span></label>
          <span className="xs muted">Connexion : {d.connection.status === 'connecte' ? 'connecté' : 'non connecté'}. Aucune intégration n’étant configurée, aucune commande ne sera envoyée.</span>
        </fieldset>

        {err && <p role="alert" className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Fiche détaillée ----------
export function DeviceSheet({ device, onClose }: { device: Device; onClose: () => void }) {
  const s = useStore();
  const [edit, setEdit] = useState(false), [msg, setMsg] = useState(''), [confirmDel, setConfirmDel] = useState(false);
  const cat = categoryOf(s.categories, device.categoryId);
  const building = s.data.buildings.find(b => b.id === device.buildingId);
  const zone = s.data.zones.find(z => z.id === (device.zoneId ?? building?.zoneId));
  const site = s.data.sites.find(x => x.id === (device.siteId ?? building?.siteId));
  const readings = useMemo(() => s.data.readings.filter(r => r.deviceId === device.id), [s.data.readings, device.id]);
  const tot = total(readings);
  const lastReading = readings.reduce<string | undefined>((m, r) => (!m || r.end > m ? r.end : m), undefined);
  const stale = lastReading ? Date.now() - Date.parse(lastReading) > 3 * 864e5 : false;
  const [r] = useRecommendations([device]);
  const cmd = checkCommand(device, s.role, COMMAND_INTEGRATION_READY);
  const plans = s.data.plans.filter(p => p.deviceId === device.id).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 5);
  const events = s.data.audit.filter(a => a.target === device.name).slice(0, 5);
  const isDemo = device.origin === 'demo';

  if (edit) return <DeviceForm device={device} onClose={() => setEdit(false)} />;

  const onImport = async (f: File) => {
    const res = parseReadingsCsv(await f.text());
    if (res.rows.length) await s.importReadings(res.rows, device.id);
    setMsg(`${res.rows.length} relevé(s) importé(s).` + (res.errors.length ? ` ${res.errors.length} ligne(s) ignorée(s) : ${res.errors.slice(0, 3).join(' ')}` : ''));
  };

  return (
    <Modal title={device.name} onClose={onClose} wide>
      <div className="stack" style={{ gap: 16 }}>
        <div className="row wrap">
          {cat && <span className="pill ghost"><Icon name={cat.icon} size={14} />{cat.name}</span>}
          {isDemo && <DatumBadge d={{ status: 'estimation' }} demo />}
          <span className={'pill ' + (device.connection.status === 'connecte' ? 'sage' : 'ghost')}>{device.connection.status === 'connecte' ? 'Connecté' : device.connection.status === 'hors_ligne' ? 'Hors ligne' : 'Non connecté'}</span>
          {device.essential && <span className="pill ghost">Usage essentiel</span>}
          {device.critical && <span className="pill danger">Système critique</span>}
        </div>

        <dl className="sheet-grid">
          <dt>Identifiant</dt><dd className="num xs">{device.id}</dd>
          <dt>Fabricant / modèle</dt><dd>{[device.manufacturer, device.model].filter(Boolean).join(' · ') || <span className="muted">Non renseigné</span>}</dd>
          {s.profile !== 'particulier' && <><dt>Localisation</dt><dd>{[site?.name, building?.name, zone?.name].filter(Boolean).join(' › ') || <span className="muted">Non localisé</span>}</dd></>}
          <dt>Puissance / cycle</dt><dd>{device.powerKw !== undefined ? `${device.powerKw.toLocaleString('fr-FR')} kW` : <span className="muted">Puissance non renseignée</span>}{device.cycleMinutes ? ` · ${device.cycleMinutes} min` : ''}</dd>
          <dt>Contraintes</dt><dd>{[device.constraints.earliestHour !== undefined && `pas avant ${device.constraints.earliestHour} h`, device.constraints.deadlineHour !== undefined && `terminé avant ${device.constraints.deadlineHour} h`, device.constraints.habitHour !== undefined && `habituellement à ${device.constraints.habitHour} h`, device.interruptible && 'interruptible'].filter(Boolean).join(', ') || <span className="muted">Aucune</span>}</dd>
        </dl>

        <section className="card soft stack">
          <div className="between"><h3 style={{ fontSize: 18 }}>Consommation</h3><DatumBadge d={tot} demo={readings.some(x => x.source === 'demo')} /></div>
          {tot.value !== undefined ? (
            <p className="small">{fmt.kwh(tot.value)} sur {readings.length} relevés · dernier relevé {fmt.date(lastReading!)} {stale && <span className="pill amber">Données de plus de 3 jours</span>}</p>
          ) : <Missing d={tot} />}
          <div className="row wrap">
            <label className="btn sm soft" style={{ cursor: 'pointer' }}>
              <Icon name="upload_file" size={18} />Importer un relevé CSV
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
            </label>
            <button type="button" className="btn sm ghost" onClick={() => download('modele-releves.csv', toCsv([{ debut: '2026-10-01 00:00', fin: '2026-10-01 01:00', kwh: '0,42' }]))}>Télécharger le modèle</button>
          </div>
          {msg && <p className="xs" role="status">{msg}</p>}
        </section>

        <section className="card soft stack">
          <h3 style={{ fontSize: 18 }}>Recommandation</h3>
          {r?.reco?.feasible && r.reco.best ? (
            <p className="small">Meilleur créneau : <b style={{ fontWeight: 500 }}>{fmt.rel(r.reco.best.start)}, {fmt.slots(r.reco.best.slots)}</b>, environ {Math.round(r.reco.best.intensity)} g CO₂/kWh <DatumBadge d={r.reco.best.co2g} />.</p>
          ) : <p className="small muted">{r?.skip ?? r?.reco?.reason ?? 'Aucune recommandation.'}</p>}
        </section>

        <section className="card soft stack">
          <h3 style={{ fontSize: 18 }}>Pilotage</h3>
          {cmd.allowed ? <p className="small">Pilotage possible.</p> : (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{cmd.reasons.map(x => <li key={x}>{x}</li>)}</ul>
          )}
          <span className="xs muted">En l’absence d’intégration, Le Bon Moment envoie uniquement des recommandations et des rappels.</span>
        </section>

        {(plans.length > 0 || events.length > 0) && (
          <section className="stack">
            <h3 style={{ fontSize: 18 }}>Historique</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {plans.map(p => <li key={p.id}>{p.mode === 'rappel' ? 'Rappel' : 'Commande'} prévu le {fmt.date(p.start)} — {p.status}</li>)}
              {events.map(a => <li key={a.id}>{fmt.date(a.at)} · {a.action} ({a.actor})</li>)}
            </ul>
          </section>
        )}

        <div className="between wrap">
          {confirmDel ? (
            <span className="row wrap"><span className="small">Supprimer cet équipement et ses relevés ?</span>
              <button type="button" className="btn sm danger" onClick={async () => { await s.remove('devices', device.id); for (const x of readings) await s.remove('readings', x.id); await s.log('Suppression d’équipement', 'ok', device.name); onClose(); }}>Confirmer la suppression</button>
              <button type="button" className="btn sm ghost" onClick={() => setConfirmDel(false)}>Annuler</button></span>
          ) : <button type="button" className="btn sm danger" onClick={() => setConfirmDel(true)} disabled={s.role === 'lecteur'}>Supprimer</button>}
          <button type="button" className="btn primary" onClick={() => setEdit(true)} disabled={s.role === 'lecteur'}>Modifier</button>
        </div>
      </div>
    </Modal>
  );
}

export function NoDevices({ onAdd }: { onAdd: () => void }) {
  const s = useStore();
  return (
    <EmptyState icon="devices" title="Aucun équipement enregistré"
      actions={<>
        <button type="button" className="btn primary sm" onClick={onAdd} disabled={s.role === 'lecteur'}>Ajouter un équipement</button>
        {!s.hasDemo && <button type="button" className="btn sm soft" onClick={s.loadDemo} disabled={s.role === 'lecteur'}>Charger un jeu de démonstration</button>}
      </>}>
      Ajoutez vos équipements pour recevoir des recommandations. Le jeu de démonstration est fictif et signalé partout.
    </EmptyState>
  );
}

import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../data/store';
import { uid } from '../../data/repo';
import type { Building, Device } from '../../core/types';
import { reverseAddress } from '../../data/sources/public';
import { Icon, fmt } from '../../ui/ui';
import StatsPanel from '../../features/StatsPanel';
import { DeviceForm, DeviceSheet, categoryOf } from '../../features/devices';
import type { Selection } from './CityMap';

const CityMap = lazy(() => import('./CityMap'));
const PALETTE = ['#0E7C86', '#D97706', '#2E6A57', '#7C3AED', '#B91C1C', '#2563A6', '#9A6B00', '#475569', '#BE185D'];

export default function Villes3D() {
  const s = useStore();
  const t = s.org!.territory!;
  const [sel, setSel] = useState<Selection>({ kind: 'ville' });
  const [showB, setShowB] = useState(true), [showD, setShowD] = useState(true);
  const [cats, setCats] = useState<Set<string>>(new Set()), [etat, setEtat] = useState('');
  const [placing, setPlacing] = useState<string | null>(null);   // bâtiment à localiser
  const [pending, setPending] = useState<{ lon: number; lat: number; address?: string; banId?: string; loading: boolean } | null>(null);
  const [newName, setNewName] = useState(''), [sheet, setSheet] = useState<Device | null>(null), [addFor, setAddFor] = useState<string | null>(null);
  const ro = s.role === 'lecteur';

  const colorOf = useMemo(() => { const m = new Map<string, string>(); s.categories.forEach((c, k) => m.set(c.id, PALETTE[k % PALETTE.length])); return m; }, [s.categories]);
  const lastByDevice = useMemo(() => { const m = new Set<string>(); s.data.readings.forEach(r => r.deviceId && m.add(r.deviceId)); return m; }, [s.data.readings]);
  const visibleDevices = s.data.devices.filter(d => (!cats.size || cats.has(d.categoryId))
    && (!etat || (etat === 'mesure' ? lastByDevice.has(d.id) : etat === 'sans_mesure' ? !lastByDevice.has(d.id) : etat === 'critique' ? d.critical : d.connection.status === etat)))
    .map(d => ({ ...d, color: colorOf.get(d.categoryId) ?? '#475569' }));

  // Équipements correspondant à la sélection courante → statistiques.
  const zoneOf = (d: Device) => d.zoneId ?? s.data.buildings.find(b => b.id === d.buildingId)?.zoneId;
  const scope = useMemo(() => {
    const all = s.data.devices;
    switch (sel.kind) {
      case 'ville': return { ids: new Set(all.map(d => d.id)), label: `Ville entière · ${t.nom}` };
      case 'zone': return { ids: new Set(all.filter(d => zoneOf(d) === sel.id).map(d => d.id)), label: `Quartier · ${s.data.zones.find(z => z.id === sel.id)?.name}` };
      case 'batiment': return { ids: new Set(all.filter(d => d.buildingId === sel.id).map(d => d.id)), label: `Bâtiment · ${s.data.buildings.find(b => b.id === sel.id)?.name}` };
      case 'categorie': return { ids: new Set(all.filter(d => d.categoryId === sel.id).map(d => d.id)), label: `Catégorie · ${categoryOf(s.categories, sel.id)?.name}` };
      case 'equipement': return { ids: new Set([sel.id]), label: `Équipement · ${all.find(d => d.id === sel.id)?.name}` };
    }
  }, [sel, s.data.devices, s.data.buildings, s.data.zones]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapClick = async (lon: number, lat: number) => {
    if (placing) {
      const b = s.data.buildings.find(x => x.id === placing); setPlacing(null);
      if (!b) return;
      const a = await reverseAddress(lon, lat).catch(() => null);
      await s.upsert('buildings', { ...b, lon, lat, address: a?.label, banId: a?.id });
      await s.log('Localisation de bâtiment', 'ok', b.name, a?.label);
      setSel({ kind: 'batiment', id: b.id });
      return;
    }
    if (ro) return;
    setPending({ lon, lat, loading: true }); setNewName('');
    const a = await reverseAddress(lon, lat).catch(() => null);
    setPending({ lon, lat, address: a?.label, banId: a?.id, loading: false });
  };

  const register = async () => {
    if (!pending || newName.trim().length < 2) return;
    const b: Building = { id: uid(), ownerId: s.ownerId, name: newName.trim(), lon: pending.lon, lat: pending.lat, address: pending.address, banId: pending.banId, origin: 'saisie' };
    await s.upsert('buildings', b); await s.log('Enregistrement de bâtiment sur la carte', 'ok', b.name, b.address);
    setPending(null); setSel({ kind: 'batiment', id: b.id });
  };

  const unlocated = s.data.buildings.filter(b => b.lon === undefined);
  const selBuilding = sel.kind === 'batiment' ? s.data.buildings.find(b => b.id === sel.id) : undefined;
  const selDevice = sel.kind === 'equipement' ? s.data.devices.find(d => d.id === sel.id) : undefined;

  return (
    <>
      <div className="between wrap">
        <div><span className="eyebrow">Territoire réel · code INSEE {t.codeInsee}</span><h1>Villes 3D · {t.nom}</h1></div>
        <Link to="/collectivite/simulateur" className="btn sm"><Icon name="science" size={18} />Simulateur de scénario (fictif)</Link>
      </div>

      <div className="c-twin">
        <div className="c-twin-map">
          <Suspense fallback={<div className="c-map-msg" role="status">Chargement de la carte…</div>}>
            <CityMap territory={t} buildings={s.data.buildings} devices={visibleDevices} showBuildings={showB} showDevices={showD} selection={sel} placing={!!placing} onSelect={setSel} onMapClick={onMapClick} />
          </Suspense>
          {placing && <div className="c-map-hint" role="status"><Icon name="ads_click" size={18} />Cliquez sur la carte à l’emplacement de « {s.data.buildings.find(b => b.id === placing)?.name} ». <button type="button" className="btn sm" onClick={() => setPlacing(null)}>Annuler</button></div>}
          {!placing && !ro && !pending && <div className="c-map-hint subtle"><Icon name="touch_app" size={18} />Cliquez sur un bâtiment de la carte pour l’enregistrer.</div>}
        </div>

        <aside className="c-panel" aria-label="Sélection et couches">
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">Sélection</span>
            <button type="button" className={'c-sel' + (sel.kind === 'ville' ? ' on' : '')} onClick={() => setSel({ kind: 'ville' })}><Icon name="location_city" size={18} />Ville entière</button>
            {s.data.zones.map(z => (
              <div key={z.id}>
                <button type="button" className={'c-sel' + (sel.kind === 'zone' && sel.id === z.id ? ' on' : '')} onClick={() => setSel({ kind: 'zone', id: z.id })}><Icon name="map" size={18} />{z.name}</button>
                <div className="c-sub">{s.data.buildings.filter(b => b.zoneId === z.id).map(b => (
                  <button key={b.id} type="button" className={'c-sel small' + (sel.kind === 'batiment' && sel.id === b.id ? ' on' : '')} onClick={() => setSel({ kind: 'batiment', id: b.id })}><Icon name="apartment" size={16} />{b.name}{b.lon === undefined && <span className="pill amber">à localiser</span>}</button>
                ))}</div>
              </div>
            ))}
            {s.data.buildings.filter(b => !b.zoneId).map(b => (
              <button key={b.id} type="button" className={'c-sel small' + (sel.kind === 'batiment' && sel.id === b.id ? ' on' : '')} onClick={() => setSel({ kind: 'batiment', id: b.id })}><Icon name="apartment" size={16} />{b.name}<span className="xs muted">hors quartier</span></button>
            ))}
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Couches</span>
            <label className="check"><input type="checkbox" checked={showB} onChange={e => setShowB(e.target.checked)} />Bâtiments enregistrés</label>
            <label className="check"><input type="checkbox" checked={showD} onChange={e => setShowD(e.target.checked)} />Équipements</label>
            <label className="field"><span>État</span><select value={etat} onChange={e => setEtat(e.target.value)}>
              <option value="">Tous</option><option value="mesure">Avec mesures</option><option value="sans_mesure">Sans mesure</option><option value="connecte">Connectés</option><option value="non_connecte">Non connectés</option><option value="critique">Systèmes critiques</option></select></label>
            <div className="c-cats" role="group" aria-label="Catégories d’équipements">
              {s.categories.map(c => (
                <button key={c.id} type="button" className="c-cat" aria-pressed={cats.has(c.id)} onClick={() => setCats(x => { const n = new Set(x); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                  onDoubleClick={() => setSel({ kind: 'categorie', id: c.id })} title="Clic : filtrer la carte · double-clic : statistiques de la catégorie">
                  <i style={{ background: colorOf.get(c.id) }} />{c.name}
                </button>
              ))}
            </div>
            <span className="xs muted">Équipements sans bâtiment localisé : visibles dans l’onglet Appareils uniquement.</span>
          </div>
        </aside>
      </div>

      {pending && (
        <div className="card bordered stack" role="region" aria-label="Enregistrer un bâtiment">
          <div className="between wrap"><h2 style={{ fontSize: 20 }}>Enregistrer un bâtiment à cet emplacement</h2><button type="button" className="btn sm ghost" onClick={() => setPending(null)}>Fermer</button></div>
          <p className="small">{pending.loading ? 'Recherche de l’adresse officielle…' : pending.address ? <>Adresse la plus proche (Base Adresse Nationale) : <b style={{ fontWeight: 500 }}>{pending.address}</b> <span className="xs muted">· identifiant {pending.banId}</span></> : 'Aucune adresse officielle trouvée à cet endroit.'}</p>
          <div className="row wrap" style={{ alignItems: 'end' }}>
            <label className="field" style={{ flex: 1, minWidth: 220 }}><span>Nom du bâtiment</span><input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex. École élémentaire…" /></label>
            <button type="button" className="btn primary" onClick={register} disabled={newName.trim().length < 2}>Enregistrer</button>
          </div>
        </div>
      )}

      {unlocated.length > 0 && !ro && (
        <div className="card bordered stack">
          <h2 style={{ fontSize: 18 }}>Bâtiments à localiser ({unlocated.length})</h2>
          <p className="small muted">Ces bâtiments n’ont pas encore de position : placez-les sur la carte pour les voir et filtrer leurs statistiques géographiquement.</p>
          <div className="row wrap">{unlocated.map(b => <button key={b.id} type="button" className="btn sm soft" onClick={() => setPlacing(b.id)}><Icon name="add_location" size={18} />{b.name}{b.origin === 'demo' && ' (démo)'}</button>)}</div>
        </div>
      )}

      {selBuilding && (
        <div className="card bordered stack">
          <div className="between wrap">
            <div><span className="eyebrow">Fiche bâtiment</span><h2 style={{ fontSize: 22 }}>{selBuilding.name}</h2>
              <p className="xs muted">{selBuilding.address ?? 'Adresse non renseignée'}{selBuilding.banId ? ` · BAN ${selBuilding.banId}` : ''}{selBuilding.lon !== undefined ? ` · ${selBuilding.lat!.toFixed(5)}, ${selBuilding.lon.toFixed(5)}` : ''}</p></div>
            <div className="row wrap">
              <label className="field"><span>Quartier</span><select value={selBuilding.zoneId ?? ''} disabled={ro} onChange={e => s.upsert('buildings', { ...selBuilding, zoneId: e.target.value || undefined })}><option value="">—</option>{s.data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
              {!ro && <button type="button" className="btn sm" onClick={() => setPlacing(selBuilding.id)}><Icon name="edit_location" size={18} />{selBuilding.lon === undefined ? 'Localiser' : 'Déplacer'}</button>}
              {!ro && <button type="button" className="btn sm primary" onClick={() => setAddFor(selBuilding.id)}><Icon name="add" size={18} />Équipement</button>}
            </div>
          </div>
          <ul className="c-devlist">
            {s.data.devices.filter(d => d.buildingId === selBuilding.id).map(d => (
              <li key={d.id}><button type="button" className="c-sel" onClick={() => setSheet(d)}><i className="c-dot" style={{ background: colorOf.get(d.categoryId) }} />{d.name}<span className="xs muted">{categoryOf(s.categories, d.categoryId)?.name}{lastByDevice.has(d.id) ? '' : ' · sans mesure'}</span></button></li>
            ))}
            {!s.data.devices.some(d => d.buildingId === selBuilding.id) && <li className="small muted">Aucun équipement enregistré pour ce bâtiment.</li>}
          </ul>
        </div>
      )}
      {selDevice && <div className="card bordered between wrap"><span className="small">Équipement sélectionné : <b style={{ fontWeight: 500 }}>{selDevice.name}</b></span><button type="button" className="btn sm soft" onClick={() => setSheet(selDevice)}>Ouvrir la fiche</button></div>}

      <StatsPanel deviceIds={scope.ids} scopeLabel={scope.label} dims={['equipement', 'categorie', 'batiment', 'zone']} />
      <p className="xs muted">Carte : © OpenStreetMap contributors (ODbL), tuiles OpenFreeMap / OpenMapTiles. Contour communal : geo.api.gouv.fr. Adresses : Base Adresse Nationale. Mis à jour {fmt.date(new Date().toISOString())}.</p>

      {sheet && <DeviceSheet device={s.data.devices.find(d => d.id === sheet.id) ?? sheet} onClose={() => setSheet(null)} />}
      {addFor && <DeviceForm onClose={() => setAddFor(null)} preset={{ buildingId: addFor, zoneId: s.data.buildings.find(b => b.id === addFor)?.zoneId }} />}
    </>
  );
}

// Gestion des sites, bâtiments et zones d'une organisation.
import { useState, type FormEvent } from 'react';
import { useStore } from '../data/store';
import { uid } from '../data/repo';
import type { Building, Site, Zone } from '../core/types';
import { Icon } from '../ui/ui';

export default function Places({ withSites = true, zoneLabel = 'Zones' }: { withSites?: boolean; zoneLabel?: string }) {
  const s = useStore();
  const ro = s.role === 'lecteur';
  const count = (pred: (d: { buildingId?: string; zoneId?: string; siteId?: string }) => boolean) => s.data.devices.filter(pred).length;
  return (
    <div className="stats-grid">
      {withSites && <List title="Sites" icon="location_on" items={s.data.sites} ro={ro}
        meta={x => `${s.data.buildings.filter(b => b.siteId === x.id).length} bâtiment(s) · ${count(d => d.siteId === x.id)} équipement(s)`}
        onAdd={async name => { const x: Site = { id: uid(), ownerId: s.ownerId, name, origin: 'saisie' }; await s.upsert('sites', x); await s.log('Ajout de site', 'ok', name); }}
        onRemove={async id => { await s.remove('sites', id); }} />}
      <List title={zoneLabel} icon="map" items={s.data.zones} ro={ro}
        meta={x => `${s.data.buildings.filter(b => b.zoneId === x.id).length} bâtiment(s) · ${count(d => d.zoneId === x.id)} équipement(s)`}
        onAdd={async name => { const x: Zone = { id: uid(), ownerId: s.ownerId, name, kind: s.profile === 'collectivite' ? 'quartier' : 'zone', origin: 'saisie' }; await s.upsert('zones', x); await s.log('Ajout de zone', 'ok', name); }}
        onRemove={async id => { await s.remove('zones', id); }} />
      <div className="card bordered stack" style={{ gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: 18 }}>Bâtiments</h3>
        <BuildingForm withSites={withSites} />
        {s.data.buildings.length === 0 ? <p className="small muted">Aucun bâtiment.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Bâtiment</th>{withSites && <th>Site</th>}<th>{zoneLabel.replace(/s$/, '')}</th><th>Adresse (BAN)</th><th className="r">Équipements</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{s.data.buildings.map(b => (
              <tr key={b.id}>
                <td>{b.name}{b.origin === 'demo' && <span className="datum demo" style={{ marginLeft: 6 }}>Démo</span>}</td>
                {withSites && <td>{s.data.sites.find(x => x.id === b.siteId)?.name ?? '—'}</td>}
                <td><select value={b.zoneId ?? ''} disabled={ro} onChange={e => s.upsert('buildings', { ...b, zoneId: e.target.value || undefined })} aria-label={`Zone de ${b.name}`}><option value="">—</option>{s.data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></td>
                <td className="xs">{b.address ?? <span className="muted">{b.lon !== undefined ? 'Localisé sans adresse' : 'Non localisé'}</span>}</td>
                <td className="r">{count(d => d.buildingId === b.id)}</td>
                <td>{!ro && <button type="button" className="btn sm ghost" onClick={() => s.remove('buildings', b.id)} aria-label={`Supprimer ${b.name}`}><Icon name="delete" size={18} /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function BuildingForm({ withSites }: { withSites: boolean }) {
  const s = useStore();
  const [name, setName] = useState(''), [site, setSite] = useState(''), [zone, setZone] = useState('');
  if (s.role === 'lecteur') return null;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (name.trim().length < 2) return;
    const b: Building = { id: uid(), ownerId: s.ownerId, name: name.trim(), siteId: site || undefined, zoneId: zone || undefined, origin: 'saisie' };
    await s.upsert('buildings', b); await s.log('Ajout de bâtiment', 'ok', b.name); setName('');
  };
  return (
    <form className="row wrap" onSubmit={submit} style={{ alignItems: 'end' }}>
      <label className="field" style={{ flex: 2, minWidth: 180 }}><span>Nouveau bâtiment</span><input className="input" value={name} onChange={e => setName(e.target.value)} /></label>
      {withSites && <label className="field" style={{ flex: 1, minWidth: 140 }}><span>Site</span><select value={site} onChange={e => setSite(e.target.value)}><option value="">—</option>{s.data.sites.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
      <label className="field" style={{ flex: 1, minWidth: 140 }}><span>Zone</span><select value={zone} onChange={e => setZone(e.target.value)}><option value="">—</option>{s.data.zones.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <button className="btn primary">Ajouter</button>
    </form>
  );
}

function List<T extends { id: string; name: string; origin: string }>({ title, icon, items, meta, onAdd, onRemove, ro }: { title: string; icon: string; items: T[]; meta: (x: T) => string; onAdd: (n: string) => Promise<void>; onRemove: (id: string) => Promise<void>; ro: boolean }) {
  const [name, setName] = useState('');
  return (
    <div className="card bordered stack">
      <h3 style={{ fontSize: 18 }} className="row"><Icon name={icon} size={20} />{title}</h3>
      {!ro && <form className="row" onSubmit={async e => { e.preventDefault(); if (name.trim().length >= 2) { await onAdd(name.trim()); setName(''); } }}>
        <label className="sr-only" htmlFor={'add-' + title}>Nom</label>
        <input id={'add-' + title} className="input" placeholder="Nom" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn sm primary">Ajouter</button>
      </form>}
      {items.length === 0 ? <p className="small muted">Aucun élément.</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {items.map(x => <li key={x.id} className="between small" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            <span><b style={{ fontWeight: 500 }}>{x.name}</b>{x.origin === 'demo' && <span className="datum demo" style={{ marginLeft: 6 }}>Démo</span>}<span className="xs muted" style={{ display: 'block' }}>{meta(x)}</span></span>
            {!ro && <button type="button" className="btn sm ghost" onClick={() => onRemove(x.id)} aria-label={`Supprimer ${x.name}`}><Icon name="delete" size={18} /></button>}
          </li>)}
        </ul>
      )}
    </div>
  );
}

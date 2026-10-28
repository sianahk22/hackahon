// Inventaire professionnel des équipements (entreprise, collectivité).
// Inventorié ≠ connecté ≠ mesuré ≠ pilotable : quatre statuts distincts.
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import type { Device } from '../core/types';
import { toCsv, download } from '../core/csv';
import { Icon, fmt } from '../ui/ui';
import { AddDeviceFlow, DeviceSheet, NoDevices, categoryOf } from './devices';

export default function Inventory({ title = 'Inventaire des équipements' }: { title?: string }) {
  const s = useStore();
  const [q, setQ] = useState(''), [cat, setCat] = useState(''), [bld, setBld] = useState(''), [zone, setZone] = useState(''), [state, setState] = useState('');
  const [open, setOpen] = useState<Device | null>(null), [adding, setAdding] = useState(false);

  const lastByDevice = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of s.data.readings) if (r.deviceId && (!m.get(r.deviceId) || r.end > m.get(r.deviceId)!)) m.set(r.deviceId, r.end);
    return m;
  }, [s.data.readings]);

  const rows = s.data.devices.filter(d => {
    const b = s.data.buildings.find(x => x.id === d.buildingId);
    const last = lastByDevice.get(d.id);
    const st = d.connection.status === 'connecte' ? 'connecte' : last ? 'mesure' : 'inventorie';
    return (!q || (d.name + ' ' + (d.manufacturer ?? '') + ' ' + (d.model ?? '')).toLowerCase().includes(q.toLowerCase()))
      && (!cat || d.categoryId === cat) && (!bld || d.buildingId === bld) && (!zone || (d.zoneId ?? b?.zoneId) === zone)
      && (!state || state === st || (state === 'pilotable' && d.control.compatible && d.control.authorized) || (state === 'critique' && d.critical));
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const exportCsv = () => download('inventaire.csv', toCsv(rows.map(d => {
    const b = s.data.buildings.find(x => x.id === d.buildingId);
    return {
      identifiant: d.id, nom: d.name, categorie: categoryOf(s.categories, d.categoryId)?.name, batiment: b?.name, zone: s.data.zones.find(z => z.id === (d.zoneId ?? b?.zoneId))?.name,
      fabricant: d.manufacturer, modele: d.model, puissance_kw: d.powerKw, connexion: d.connection.status, dernier_releve: lastByDevice.get(d.id), pilotable: d.control.compatible && d.control.authorized ? 'oui' : 'non', critique: d.critical ? 'oui' : 'non', origine: d.origin,
    };
  })));

  return (
    <section className="stack" style={{ gap: 14 }}>
      <div className="between wrap">
        <div><h1 style={{ fontSize: 28 }}>{title}</h1><p className="small muted">{s.data.devices.length} équipement{s.data.devices.length > 1 ? 's' : ''} enregistré{s.data.devices.length > 1 ? 's' : ''} · {rows.length} affiché{rows.length > 1 ? 's' : ''}</p></div>
        <div className="row wrap">
          <button type="button" className="btn sm" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={18} />Exporter</button>
          <button type="button" className="btn sm primary" onClick={() => setAdding(true)} disabled={s.role === 'lecteur'}><Icon name="add" size={18} />Ajouter</button>
        </div>
      </div>

      {s.data.devices.length === 0 ? <NoDevices onAdd={() => setAdding(true)} /> : <>
        <div className="filters">
          <label className="field"><span>Recherche</span><input className="input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, fabricant, modèle" /></label>
          <label className="field"><span>Catégorie</span><select value={cat} onChange={e => setCat(e.target.value)}><option value="">Toutes</option>{s.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Bâtiment</span><select value={bld} onChange={e => setBld(e.target.value)}><option value="">Tous</option>{s.data.buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="field"><span>{s.profile === 'collectivite' ? 'Quartier / zone' : 'Zone'}</span><select value={zone} onChange={e => setZone(e.target.value)}><option value="">Toutes</option>{s.data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
          <label className="field"><span>État</span><select value={state} onChange={e => setState(e.target.value)}>
            <option value="">Tous</option><option value="inventorie">Inventorié, sans mesure</option><option value="mesure">Mesuré (relevés)</option><option value="connecte">Connecté</option><option value="pilotable">Pilotage autorisé</option><option value="critique">Système critique</option>
          </select></label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Équipement</th><th>Catégorie</th><th>Localisation</th><th className="r">Puissance</th><th>Connexion</th><th>Mesures</th><th>Pilotage</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map(d => {
                const b = s.data.buildings.find(x => x.id === d.buildingId);
                const z = s.data.zones.find(x => x.id === (d.zoneId ?? b?.zoneId));
                const last = lastByDevice.get(d.id);
                const fresh = last ? Date.now() - Date.parse(last) < 3 * 864e5 : false;
                return (
                  <tr key={d.id}>
                    <td><b style={{ fontWeight: 500 }}>{d.name}</b>{d.origin === 'demo' && <span className="datum demo" style={{ marginLeft: 6 }}>Démo</span>}{d.critical && <span className="pill danger" style={{ marginLeft: 6 }}>Critique</span>}<div className="xs muted">{[d.manufacturer, d.model].filter(Boolean).join(' · ')}</div></td>
                    <td>{categoryOf(s.categories, d.categoryId)?.name ?? '—'}</td>
                    <td>{[b?.name, z?.name].filter(Boolean).join(' · ') || <span className="muted">Non localisé</span>}</td>
                    <td className="r">{d.powerKw !== undefined ? `${d.powerKw.toLocaleString('fr-FR')} kW` : '—'}</td>
                    <td><span className={'pill ' + (d.connection.status === 'connecte' ? 'sage' : 'ghost')}>{d.connection.status === 'connecte' ? 'Connecté' : d.connection.status === 'hors_ligne' ? 'Hors ligne' : 'Non connecté'}</span></td>
                    <td>{last ? <span className={'pill ' + (fresh ? 'sage' : 'amber')} title={`Dernier relevé : ${fmt.date(last)}`}>{fresh ? 'À jour' : 'Ancien'}</span> : <span className="pill ghost">Aucune</span>}</td>
                    <td>{d.critical ? <span className="xs muted">Exclu</span> : d.control.compatible && d.control.authorized ? <span className="xs">Autorisé · sans intégration</span> : <span className="xs muted">Conseils</span>}</td>
                    <td><button type="button" className="btn sm soft" onClick={() => setOpen(d)} aria-label={`Ouvrir la fiche de ${d.name}`}>Fiche</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>}
      {open && <DeviceSheet device={s.data.devices.find(x => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
      {adding && <AddDeviceFlow onClose={() => setAdding(false)} />}
    </section>
  );
}

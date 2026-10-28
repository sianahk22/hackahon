import { useState } from 'react';
import { useStore } from '../../data/store';
import type { Device } from '../../core/types';
import { DatumBadge, Icon, fmt } from '../../ui/ui';
import { AddDeviceFlow, DeviceSheet, NoDevices, categoryOf } from '../../features/devices';
import { useRecommendations } from '../../features/reco';

type Filter = 'tous' | 'pilotables' | 'conseils';

export default function Appareils() {
  const s = useStore();
  const [filter, setFilter] = useState<Filter>('tous'), [open, setOpen] = useState<Device | null>(null), [adding, setAdding] = useState(false);
  const devices = s.data.devices;
  const pilotables = devices.filter(d => d.control.compatible);
  const connected = devices.filter(d => d.connection.status === 'connecte');
  const shown = filter === 'tous' ? devices : filter === 'pilotables' ? pilotables : devices.filter(d => !d.control.compatible);
  const recos = useRecommendations(shown);

  return (
    <>
      <section className="stack" style={{ gap: 4, marginTop: 8 }}>
        <div className="between" style={{ alignItems: 'baseline' }}>
          <h1 className="p-h2" style={{ fontSize: 28 }}>Vos Équipements</h1>
          <span className="pill" style={{ fontSize: 12, padding: '4px 10px' }}>{devices.length} configuré{devices.length > 1 ? 's' : ''} • {connected.length} connecté{connected.length > 1 ? 's' : ''}</span>
        </div>
        <p className="small" style={{ color: 'var(--ink-2)' }}>Vos appareils, leurs contraintes et leur meilleur moment.</p>
      </section>

      <div className="card soft row" style={{ alignItems: 'flex-start', gap: 10, padding: 16 }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sage-wash)', color: 'var(--sage-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="balance" size={18} /></span>
        <div style={{ display: 'grid', gap: 4 }}>
          <h2 className="p-title">Gestion raisonnée</h2>
          <p className="small" style={{ color: 'var(--ink-2)' }}>Nous distinguons les appareils pilotables (quand une intégration le permet) de ceux pour lesquels nous envoyons des rappels au bon moment. Aujourd’hui, aucune intégration de pilotage n’est configurée : tous reçoivent des rappels.</p>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrer les équipements">
        <button type="button" className="chip" aria-pressed={filter === 'tous'} onClick={() => setFilter('tous')}>Tous ({devices.length})</button>
        <button type="button" className="chip" aria-pressed={filter === 'pilotables'} onClick={() => setFilter('pilotables')}>Pilotables ({pilotables.length})</button>
        <button type="button" className="chip" aria-pressed={filter === 'conseils'} onClick={() => setFilter('conseils')}>Conseils seuls ({devices.length - pilotables.length})</button>
        <button type="button" className="chip" onClick={() => setAdding(true)}><Icon name="add" size={14} /> Ajouter</button>
      </div>

      {devices.length === 0 ? <NoDevices onAdd={() => setAdding(true)} /> : (
        <section className="stack" style={{ gap: 16 }}>
          {recos.map(({ device: d, reco, skip }) => {
            const cat = categoryOf(s.categories, d.categoryId);
            const readings = s.data.readings.filter(r => r.deviceId === d.id).length;
            return (
              <article key={d.id} className="card p-device">
                <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                  <span className="p-device-tile"><Icon name={cat?.icon ?? 'devices_other'} size={24} /></span>
                  <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
                    <span className="row wrap" style={{ gap: 6 }}>
                      <span className="p-device-brand">{[d.manufacturer, d.connection.status === 'connecte' ? 'Connecté' : 'Manuel'].filter(Boolean).join(' • ')}</span>
                      {d.control.compatible ? <span className="pill sage">Pilotable</span> : <span className="pill ghost">Conseil seul</span>}
                      {d.origin === 'demo' && <DatumBadge d={{ status: 'estimation' }} demo />}
                    </span>
                    <h2 className="p-device-name">{d.name}</h2>
                  </div>
                  <label className="switch" title="Pilotage automatique : aucune intégration configurée">
                    <input type="checkbox" role="switch" checked={false} disabled aria-label={`Pilotage automatique de ${d.name} : indisponible, aucune intégration configurée`} />
                  </label>
                </div>
                <div className="p-device-note">
                  <Icon name={reco?.feasible ? 'light_mode' : 'info'} size={18} />
                  <span>{reco?.feasible && reco.best ? <>Meilleur créneau : <b style={{ fontWeight: 500 }}>{fmt.rel(reco.best.start)}, {fmt.slots(reco.best.slots)}</b></> : skip ?? reco?.reason}</span>
                </div>
                <div className="between xs muted">
                  <span>{readings ? `${readings} relevé(s) de consommation` : 'Aucune mesure de consommation'}</span>
                  <button type="button" className="btn soft sm" onClick={() => setOpen(d)}>Voir la fiche</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <button type="button" className="p-add" onClick={() => setAdding(true)}><Icon name="add_circle" />Associer un nouvel équipement ou compteur Linky</button>
      <p className="xs muted" style={{ textAlign: 'center' }}>Intégrations prévues : Enedis Data Connect, Matter, API constructeurs. Aucune n’est encore configurée.</p>

      {open && <DeviceSheet device={s.data.devices.find(x => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
      {adding && <AddDeviceFlow onClose={() => setAdding(false)} />}
    </>
  );
}

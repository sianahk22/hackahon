// Tableau des recommandations pour une organisation (plusieurs équipements).
import { useState } from 'react';
import { useStore } from '../data/store';
import type { Device } from '../core/types';
import { carbonLevel } from '../core/carbon';
import { DatumBadge, EmptyState, Icon, fmt } from '../ui/ui';
import { CarbonBand } from './charts';
import { useRecommendations, gainOf } from './reco';
import { planOption } from './plans';
import { categoryOf } from './devices';

export function CarbonNow() {
  const s = useStore();
  const c = s.carbon.value, now = Date.now(), cur = c?.current(now);
  return (
    <div className="card bordered stack">
      <div className="between wrap">
        <div><span className="eyebrow">Intensité carbone du réseau (France)</span>
          <div className="row" style={{ gap: 10 }}><b className="serif num" style={{ fontWeight: 400, fontSize: 30, color: 'var(--primary)' }}>{cur?.value !== undefined ? Math.round(cur.value) : '—'}</b><span className="small muted">g CO₂/kWh</span>
            {cur?.value !== undefined && <span className="pill sage">{carbonLevel(cur.value).label}</span>}{cur && <DatumBadge d={cur} />}</div></div>
        <button type="button" className="btn sm ghost" onClick={s.refreshSources}><Icon name="refresh" size={18} />Actualiser</button>
      </div>
      {c && !c.empty ? <CarbonBand carbon={c} from={Math.floor(now / 1800e3) * 1800e3} /> : <p className="small muted">{s.carbon.status === 'erreur' ? `Données RTE indisponibles (${s.carbon.error}).` : 'Chargement des données RTE…'}</p>}
      <span className="xs muted">Source : RTE éCO2mix. Heures à venir : estimation (profil des 7 derniers jours recalé sur la dernière mesure).</span>
    </div>
  );
}

export default function RecoBoard({ devices }: { devices?: Device[] }) {
  const s = useStore();
  const list = useRecommendations(devices ?? s.data.devices).slice().sort((a, b) => gainOf(b) - gainOf(a));
  const [done, setDone] = useState<Record<string, boolean>>({});
  const canPlan = s.role !== 'lecteur';
  if (!list.length) return <EmptyState icon="devices" title="Aucun équipement">Ajoutez des équipements dans l’inventaire pour obtenir des recommandations.</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Équipement</th><th>Meilleur créneau</th><th className="r">Intensité</th><th className="r">Gain CO₂ prévu</th><th className="r">Coût</th><th><span className="sr-only">Action</span></th></tr></thead>
        <tbody>
          {list.map(({ device: d, reco, skip }) => {
            const b = reco?.best;
            return (
              <tr key={d.id}>
                <td><span className="row" style={{ gap: 8 }}><Icon name={categoryOf(s.categories, d.categoryId)?.icon ?? 'devices_other'} size={18} /><b style={{ fontWeight: 500 }}>{d.name}</b>{d.origin === 'demo' && <span className="datum demo">Démo</span>}</span></td>
                {b ? <>
                  <td>{fmt.rel(b.start)}, {fmt.slots(b.slots)} <DatumBadge d={b.co2g} /></td>
                  <td className="r">{Math.round(b.intensity)} g/kWh</td>
                  <td className="r">{reco!.avoidedCo2g?.value !== undefined ? fmt.co2(reco!.avoidedCo2g.value) : <span className="muted" title="Heure habituelle non renseignée">n.c.</span>}</td>
                  <td className="r">{b.costEur.value !== undefined ? fmt.eur(b.costEur.value) : <span className="muted" title={b.costEur.reason}>n.c.</span>}</td>
                  <td><button type="button" className="btn sm soft" disabled={!canPlan || done[d.id]} onClick={async () => { await planOption(s, d, b, reco); setDone(x => ({ ...x, [d.id]: true })); }}>{done[d.id] ? 'Planifié' : 'Planifier'}</button></td>
                </> : <td colSpan={5} className="muted">{skip ?? reco?.reason}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PlansList() {
  const s = useStore();
  const now = Date.now();
  const plans = s.data.plans.filter(p => p.status === 'prevu' && Date.parse(p.end) > now).sort((a, b) => a.start.localeCompare(b.start));
  if (!plans.length) return <p className="small muted">Aucun usage planifié à venir.</p>;
  return (
    <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
      {plans.map(p => {
        const d = s.data.devices.find(x => x.id === p.deviceId);
        return (
          <li key={p.id} className="between wrap card bordered" style={{ padding: 12 }}>
            <span className="small"><b style={{ fontWeight: 500 }}>{d?.name ?? 'Équipement supprimé'}</b> · {fmt.rel(Date.parse(p.start))} {fmt.time(Date.parse(p.start))} – {fmt.time(Date.parse(p.end))} · <span className="muted">rappel (aucune commande envoyée)</span></span>
            {s.role !== 'lecteur' && <span className="row"><button type="button" className="btn sm ghost" onClick={() => s.upsert('plans', { ...p, status: 'annule' })}>Annuler</button><button type="button" className="btn sm soft" onClick={() => s.upsert('plans', { ...p, status: 'fait' })}>Fait</button></span>}
          </li>
        );
      })}
    </ul>
  );
}

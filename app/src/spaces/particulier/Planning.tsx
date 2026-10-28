import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../../data/store';
import { recommend, type Recommendation } from '../../core/recommend';
import { parisDayStart } from '../../core/tariffs';
import { carbonLevel } from '../../core/carbon';
import type { Device, Plan } from '../../core/types';
import { DatumBadge, EmptyState, Icon, Modal, fmt } from '../../ui/ui';
import { CarbonBand } from '../../features/charts';
import { categoryOf, NoDevices, AddDeviceFlow } from '../../features/devices';
import { needFor } from '../../features/reco';
import { planOption } from '../../features/plans';

const H = 3600e3;

export default function Planning() {
  const s = useStore();
  const now = Date.now();
  const days = useMemo(() => Array.from({ length: 7 }, (_, k) => fmt.dayKey(now + k * 864e5)), [fmt.dayKey(now)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(days[0]);
  const [mode, setMode] = useState<'conseils' | 'planning'>('planning');
  const [adding, setAdding] = useState(false), [addingDevice, setAddingDevice] = useState(false);
  const start = parisDayStart(day), end = start + 24 * H;
  const carbon = s.carbon.value;
  const cur = carbon?.current(now);

  const plans = s.data.plans.filter(p => p.status !== 'annule' && Date.parse(p.start) < end && Date.parse(p.end) > start).sort((a, b) => a.start.localeCompare(b.start));
  const week = s.data.plans.filter(p => p.status !== 'annule' && Date.parse(p.start) >= parisDayStart(days[0]) && Date.parse(p.start) < parisDayStart(days[6]) + 24 * H);
  const weekAvoided = week.reduce((acc, p) => acc + (p.refCo2g !== undefined && p.co2g !== undefined ? p.refCo2g - p.co2g : 0), 0);
  const weekWithRef = week.filter(p => p.refCo2g !== undefined).length;

  // Conseils du jour choisi : fenêtre = ce jour (à partir de maintenant si c'est aujourd'hui).
  const advice = useMemo(() => s.data.devices.map(d => {
    const { need, skip } = needFor(d, Math.max(now, start), { earliest: Math.max(now, start), deadline: d.constraints.deadlineHour !== undefined ? Math.min(end + 8 * H, start + (d.constraints.deadlineHour + (d.constraints.deadlineHour < 12 ? 24 : 0)) * H) : end });
    if (!need || !carbon || carbon.empty) return { d, skip: skip ?? 'Intensité carbone indisponible.' };
    return { d, r: recommend(need, { carbon, tariff: s.settings.tariff, tempo: s.tempo.value ?? {}, now }) };
  }), [s.data.devices, carbon, s.settings.tariff, s.tempo.value, start]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <section className="stack" style={{ gap: 4, marginTop: 8 }}>
        <div className="between">
          <span className="p-label" style={{ textTransform: 'uppercase', color: 'var(--ink-2)' }}>Synchronisation réseau</span>
          {cur?.value !== undefined && <span className="pill sage"><span className="dot" />{carbonLevel(cur.value).label} · {Math.round(cur.value)} g</span>}
        </div>
        <h1 className="p-h2">Chronologie du jour</h1>
        <p style={{ color: 'var(--ink-2)' }}>Organisez vos usages selon l’intensité carbone du réseau électrique.</p>
      </section>

      <div className="p-seg" role="group" aria-label="Mode d’affichage">
        <button type="button" aria-pressed={mode === 'conseils'} onClick={() => setMode('conseils')}>Mode Conseils</button>
        <button type="button" aria-pressed={mode === 'planning'} onClick={() => setMode('planning')}>Mode Planning</button>
      </div>

      <div className="p-days" role="group" aria-label="Choisir le jour">
        {days.map(k => {
          const t = parisDayStart(k);
          const has = s.data.plans.some(p => p.status !== 'annule' && fmt.dayKey(Date.parse(p.start)) === k);
          return (
            <button key={k} type="button" className="p-day" aria-pressed={k === day} onClick={() => setDay(k)} aria-label={fmt.day(t + 12 * H)}>
              <span>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short' }).format(new Date(t + 12 * H)).replace('.', '')}</span>
              <b>{+k.slice(8)}</b>
              <span className="dot" style={{ color: has ? 'var(--teal)' : 'transparent' }} />
            </button>
          );
        })}
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="between wrap">
          <span className="row"><Icon name="air" size={18} /><span className="p-title" style={{ fontSize: 15 }}>Rythme énergétique des 24 h</span></span>
          {carbon && !carbon.empty && <DatumBadge d={carbon.at(start + 12 * H, now)} />}
        </div>
        {carbon && !carbon.empty ? <CarbonBand carbon={carbon} from={start} /> : <p className="small muted">Intensité carbone indisponible.</p>}
        <span className="xs muted">Vert : bas carbone · orange : modéré · rouge : élevé. Au-delà de 48 h, l’estimation est peu fiable.</span>
      </section>

      {s.data.devices.length === 0 ? <NoDevices onAdd={() => setAddingDevice(true)} /> : mode === 'planning' ? (
        <section className="stack" style={{ gap: 12 }}>
          <div className="between"><h2 className="p-h3">Ligne du temps</h2><span className="xs muted">{fmt.day(start + 12 * H)}</span></div>
          {plans.length === 0 ? <EmptyState icon="event_available" title="Aucun usage planifié ce jour">Ajoutez un usage ou passez en mode Conseils pour voir les meilleurs créneaux.</EmptyState> : (
            <div className="p-timeline">{plans.map(p => <PlanItem key={p.id} p={p} />)}</div>
          )}
        </section>
      ) : (
        <section className="stack" style={{ gap: 12 }}>
          <h2 className="p-h3">Conseils pour ce jour</h2>
          {advice.map(({ d, r, skip }) => <AdviceCard key={d.id} d={d} r={r} skip={skip} />)}
        </section>
      )}

      <section className="card stack">
        <div className="between"><div><span className="xs muted">Cette semaine</span><h2 className="p-title">{week.length} usage{week.length > 1 ? 's' : ''} planifié{week.length > 1 ? 's' : ''}</h2></div>
          <span className="p-iconbtn" style={{ background: 'var(--sage-wash)', color: 'var(--sage-ink)' }}><Icon name="energy_savings_leaf" /></span></div>
        <p className="small" style={{ color: 'var(--ink-2)' }}>
          {weekWithRef ? <>Gain prévu : environ <b style={{ fontWeight: 500 }}>{fmt.co2(weekAvoided)} de CO₂</b> par rapport à vos heures habituelles ({weekWithRef} usage{weekWithRef > 1 ? 's' : ''} comparable{weekWithRef > 1 ? 's' : ''}). <DatumBadge d={{ status: 'estimation', method: 'Somme des écarts prévus au moment de la planification' }} /></>
            : 'Renseignez l’heure habituelle de vos appareils pour estimer le gain prévu.'}
        </p>
      </section>

      <button type="button" className="p-fab" onClick={() => setAdding(true)} disabled={!s.data.devices.length}><Icon name="add" />Ajouter un usage</button>
      {adding && <AddUsage day={day} onClose={() => setAdding(false)} />}
      {addingDevice && <AddDeviceFlow onClose={() => setAddingDevice(false)} />}
    </>
  );
}

function PlanItem({ p }: { p: Plan }) {
  const s = useStore();
  const d = s.data.devices.find(x => x.id === p.deviceId);
  const cat = d ? categoryOf(s.categories, d.categoryId) : undefined;
  const set = async (status: Plan['status']) => { await s.upsert('plans', { ...p, status }); await s.log(status === 'fait' ? 'Usage réalisé' : 'Usage annulé', 'ok', d?.name); };
  return (
    <div className={'p-tl-item' + (p.status === 'fait' ? ' done' : '')}>
      <article className="card stack" style={{ gap: 8, padding: 16 }}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="p-iconbtn"><Icon name={cat?.icon ?? 'devices_other'} size={20} /></span>
            <div style={{ display: 'grid' }}>
              <span className="xs" style={{ color: 'var(--teal)', fontWeight: 500 }}>{fmt.time(Date.parse(p.start))} – {fmt.time(Date.parse(p.end))}</span>
              <span className="p-title">{d?.name ?? 'Équipement supprimé'}</span>
            </div>
          </div>
          <span className={'pill ' + (p.status === 'fait' ? 'sage' : 'ghost')}>{p.status === 'fait' ? 'Réalisé' : 'Rappel'}</span>
        </div>
        <p className="small" style={{ color: 'var(--ink-2)' }}>{p.explanation}</p>
        <div className="between wrap">
          <span className="row xs" style={{ color: 'var(--sage)' }}><Icon name="eco" size={16} />
            {p.refCo2g !== undefined && p.co2g !== undefined ? `${fmt.co2(p.refCo2g - p.co2g)} CO₂ évités (prévision)` : p.co2g !== undefined ? `${fmt.co2(p.co2g)} CO₂ (prévision)` : 'Impact non calculé'}</span>
          {p.status === 'prevu' && <span className="row"><button type="button" className="btn sm ghost" onClick={() => set('annule')}>Annuler</button><button type="button" className="btn sm primary" onClick={() => set('fait')}>C’est fait</button></span>}
        </div>
      </article>
    </div>
  );
}

function AdviceCard({ d, r, skip }: { d: Device; r?: Recommendation; skip?: string }) {
  const s = useStore();
  const [ok, setOk] = useState(false);
  const cat = categoryOf(s.categories, d.categoryId);
  return (
    <article className="card stack" style={{ gap: 8, padding: 16 }}>
      <div className="row" style={{ gap: 12 }}>
        <span className="p-iconbtn"><Icon name={cat?.icon ?? 'devices_other'} size={20} /></span>
        <span className="p-title">{d.name}</span>
      </div>
      {r?.feasible && r.best ? <>
        <p className="small">Meilleur créneau : <b style={{ fontWeight: 500 }}>{fmt.rel(r.best.start)}, {fmt.slots(r.best.slots)}</b> · ≈ {Math.round(r.best.intensity)} g CO₂/kWh <DatumBadge d={r.best.co2g} /></p>
        <button type="button" className="btn soft sm" style={{ justifySelf: 'start' }} disabled={ok} onClick={async () => { await planOption(s, d, r.best!, r); setOk(true); }}>{ok ? 'Rappel enregistré' : 'Planifier'}</button>
      </> : <p className="small muted">{skip ?? r?.reason}{d.essential && ' Astuce : choisir un programme éco réduit la consommation sans changer l’horaire.'}</p>}
    </article>
  );
}

function AddUsage({ day, onClose }: { day: string; onClose: () => void }) {
  const s = useStore();
  const now = Date.now();
  const movable = s.data.devices.filter(d => !d.essential && !d.critical);
  const [deviceId, setDeviceId] = useState(movable[0]?.id ?? '');
  const [from, setFrom] = useState(Math.max(0, +fmt.hour(now).replace('h', '')));
  const [until, setUntil] = useState(22);
  const [res, setRes] = useState<Recommendation | null>(null), [err, setErr] = useState('');
  const d = s.data.devices.find(x => x.id === deviceId);
  const start = parisDayStart(day);

  const compute = (e: FormEvent) => {
    e.preventDefault(); setErr(''); setRes(null);
    if (!d) return;
    const carbon = s.carbon.value;
    if (!carbon || carbon.empty) return setErr('Intensité carbone indisponible.');
    const earliest = Math.max(now, start + from * H);
    const deadline = start + (until <= from ? until + 24 : until) * H;
    const { need, skip } = needFor(d, earliest, { earliest, deadline });
    if (!need) return setErr(skip ?? 'Impossible de calculer.');
    setRes(recommend(need, { carbon, tariff: s.settings.tariff, tempo: s.tempo.value ?? {}, now }));
  };

  return (
    <Modal title="Ajouter un usage" onClose={onClose}>
      <form className="stack" onSubmit={compute}>
        {movable.length === 0 ? <p className="small muted">Aucun appareil déplaçable : les usages essentiels ne sont pas décalés.</p> : <>
          <label className="field"><span>Appareil</span><select value={deviceId} onChange={e => { setDeviceId(e.target.value); setRes(null); }}>{movable.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <div className="form-grid">
            <label className="field"><span>Pas avant ({fmt.day(start + 12 * H)})</span><select value={from} onChange={e => setFrom(+e.target.value)}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h</option>)}</select></label>
            <label className="field"><span>Terminé avant</span><select value={until} onChange={e => setUntil(+e.target.value)}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h{h <= from ? ' (lendemain)' : ''}</option>)}</select></label>
          </div>
          <button className="btn primary">Trouver le meilleur moment</button>
        </>}
        {err && <p role="alert" className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
      </form>
      {res && d && (
        <div className="stack" style={{ marginTop: 16 }}>
          {!res.feasible ? <p className="small" role="status">{res.reason}</p> : [res.best!, ...res.alternatives].map((o, k) => (
            <div key={o.start} className="card bordered between wrap">
              <div style={{ display: 'grid' }}>
                <span className="xs muted">{k === 0 ? 'Recommandé' : `Alternative ${k}`}</span>
                <b style={{ fontWeight: 500 }}>{fmt.rel(o.start)}, {fmt.slots(o.slots)}</b>
                <span className="xs">{fmt.co2(o.co2g.value!)} CO₂ · ≈ {Math.round(o.intensity)} g/kWh{o.costEur.value !== undefined ? ` · ${fmt.eur(o.costEur.value)}` : ''} <DatumBadge d={o.co2g} /></span>
              </div>
              <button type="button" className={'btn sm ' + (k === 0 ? 'primary' : 'soft')} onClick={async () => { await planOption(s, d, o, res); onClose(); }}>Planifier</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

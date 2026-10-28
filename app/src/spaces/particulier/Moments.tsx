import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../data/store';
import { carbonLevel } from '../../core/carbon';
import type { Option } from '../../core/recommend';
import { DatumBadge, Icon, Missing, fmt } from '../../ui/ui';
import { useRecommendations, gainOf, type DeviceReco } from '../../features/reco';
import { categoryOf, AddDeviceFlow, NoDevices } from '../../features/devices';
import { planOption } from '../../features/plans';
import { inRanges, parisParts } from '../../core/tariffs';

export default function Moments() {
  const s = useStore();
  const [q, setQ] = useState(''), [group, setGroup] = useState('Tous'), [adding, setAdding] = useState(false), [done, setDone] = useState<string | null>(null);
  const now = Date.now();
  const carbon = s.carbon.value;
  const cur = carbon?.current(now);

  // Pic et creux estimés sur les 24 prochaines heures (quarts d'heure).
  const outlook = useMemo(() => {
    if (!carbon || carbon.empty) return null;
    let min = { t: 0, v: Infinity }, max = { t: 0, v: -Infinity };
    for (let t = Math.ceil(now / 9e5) * 9e5; t < now + 24 * 3600e3; t += 9e5) {
      const d = carbon.at(t + 4.5e5, now); if (d.value === undefined) continue;
      if (d.value < min.v) min = { t, v: d.value }; if (d.value > max.v) max = { t, v: d.value };
    }
    return isFinite(min.v) ? { min, max } : null;
  }, [carbon, Math.floor(now / 9e5)]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => ['Tous', ...new Set(s.data.devices.map(d => categoryOf(s.categories, d.categoryId)?.group ?? 'Autres'))], [s.data.devices, s.categories]);
  const devices = s.data.devices.filter(d => (group === 'Tous' || (categoryOf(s.categories, d.categoryId)?.group ?? 'Autres') === group) && d.name.toLowerCase().includes(q.trim().toLowerCase()));
  const recos = useRecommendations(devices, now).slice().sort((a, b) => gainOf(b) - gainOf(a));
  const hero = recos.find(r => r.reco?.feasible);
  const others = recos.filter(r => r !== hero);

  const level = cur?.value !== undefined ? carbonLevel(cur.value) : null;
  const goodNow = outlook && cur?.value !== undefined && cur.value <= outlook.min.v * 1.1;
  const headline = !cur || cur.value === undefined ? 'L’intensité carbone du réseau est indisponible pour le moment.'
    : goodNow ? `C’est un bon moment : le réseau est ${level!.label.toLowerCase()} en ce moment.`
    : outlook ? `Le meilleur moment des prochaines 24 h est attendu ${fmt.rel(outlook.min.t).toLowerCase()} vers ${fmt.hour(outlook.min.t)}.` : '';

  return (
    <>
      <section className="stack" style={{ gap: 4, paddingTop: 8 }}>
        <div className="p-status">
          <span className={'dot' + (cur?.status === 'mesure' ? ' pulse' : '')} style={{ color: cur?.status === 'mesure' ? 'var(--teal)' : 'var(--muted)' }} />
          <span className="p-label">{cur?.value !== undefined ? `Réseau ${level!.label.toLowerCase()} • ${Math.round(cur.value)} g CO₂/kWh` : 'Intensité carbone indisponible'}</span>
          {cur && <DatumBadge d={cur} />}
        </div>
        <h1 className="p-hello">Bonjour {s.account?.displayName} — {headline}</h1>
        <p style={{ color: 'var(--ink-2)' }}>
          {s.carbon.status === 'chargement' ? 'Récupération des données RTE éCO2mix…'
            : s.carbon.status === 'erreur' ? <>Les données RTE n’ont pas pu être chargées ({s.carbon.error}). <button type="button" className="btn sm ghost" onClick={s.refreshSources}>Réessayer</button></>
            : 'Intensité mesurée par RTE (éCO2mix) ; les heures à venir sont estimées à partir des 7 derniers jours.'}
        </p>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <label className="p-search">
          <Icon name="search" />
          <span className="sr-only">Rechercher un équipement</span>
          <input type="search" placeholder="Rechercher un équipement…" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filtrer par catégorie">
          {groups.map(g => <button key={g} type="button" className="chip" aria-pressed={g === group} onClick={() => setGroup(g)}>{g}</button>)}
        </div>
      </section>

      {s.data.devices.length === 0 ? <NoDevices onAdd={() => setAdding(true)} /> : hero ? (
        <HeroCard r={hero} done={done === hero.device.id} onPlan={async o => { await planOption(s, hero.device, o, hero.reco); setDone(hero.device.id); }} />
      ) : (
        <div className="card stack">
          <span className="p-label" style={{ textTransform: 'uppercase', color: 'var(--sage)' }}>Recommandation</span>
          <p className="small muted">{recos[0]?.skip ?? recos[0]?.reco?.reason ?? 'Aucun équipement ne correspond à ce filtre.'}</p>
          <Link to="/particulier/appareils" className="btn soft sm" style={{ justifySelf: 'start' }}>Compléter mes équipements</Link>
        </div>
      )}

      {outlook && outlook.max.v > outlook.min.v * 1.3 && (
        <section className="p-mood" aria-label="Prochain pic d’intensité carbone">
          <div className="between" style={{ width: '100%' }}>
            <span className="row small"><Icon name="bedtime_off" size={20} />Prochain pic d’intensité carbone estimé {fmt.rel(outlook.max.t).toLowerCase()} vers {fmt.hour(outlook.max.t)} ({Math.round(outlook.max.v)} g/kWh)</span>
            <span className="tag">Estimation</span>
          </div>
        </section>
      )}

      {hero?.reco && hero.reco.alternatives.length > 0 && (
        <section className="stack" id="alternatives" style={{ gap: 8 }}>
          <div className="between"><h2 className="p-h3">Créneaux alternatifs &amp; Faisabilité</h2><span className="p-label" style={{ color: 'var(--sage)' }}>{hero.reco.alternatives.length} choix</span></div>
          {hero.reco.alternatives.map((o, k) => <AltCard key={o.start} o={o} best={hero.reco!.best!} letter={'AB'[k]} onPick={async () => { await planOption(s, hero.device, o, hero.reco); setDone(hero.device.id); }} />)}
        </section>
      )}

      {others.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <h2 className="p-h3">Vos autres équipements</h2>
          {others.map(r => (
            <div key={r.device.id} className="card row" style={{ padding: 16, gap: 12 }}>
              <span className="p-iconbtn"><Icon name={categoryOf(s.categories, r.device.categoryId)?.icon ?? 'devices_other'} size={20} /></span>
              <span style={{ display: 'grid', minWidth: 0 }}>
                <span className="p-title" style={{ fontSize: 16 }}>{r.device.name}</span>
                <span className="small muted">{r.reco?.feasible && r.reco.best ? `${fmt.rel(r.reco.best.start)}, ${fmt.slots(r.reco.best.slots)}` : r.skip ?? r.reco?.reason}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="stack" style={{ gap: 8 }}>
        <div className="between"><h2 className="p-h3">Vue d’ensemble du foyer</h2><span className="p-label muted">{s.carbon.at ? `Mis à jour ${fmt.time(Date.parse(s.carbon.at))}` : ''}</span></div>
        <div className="p-mosaic">
          <div className="card p-tile">
            <div className="between" style={{ color: 'var(--sage)' }}><span className="p-label" style={{ textTransform: 'uppercase' }}>Mix actuel</span><Icon name="bolt" size={18} /></div>
            {cur?.value !== undefined ? <>
              <div><span className="v num">{Math.round(cur.value)}</span> <span className="small muted">g CO₂/kWh</span>
                <div className="row xs" style={{ color: 'var(--sage)', marginTop: 4 }}><span className="dot" />{level!.label}</div></div>
              <div className="p-gauge" aria-hidden="true"><i style={{ width: `${Math.max(5, Math.min(100, 100 - cur.value / 1.5))}%` }} /></div>
            </> : <Missing d={cur ?? { status: 'indisponible' }} />}
          </div>
          <div className="card p-tile">
            <div className="between" style={{ color: 'var(--sage)' }}><span className="p-label" style={{ textTransform: 'uppercase' }}>Usages planifiés</span><Icon name="spa" size={18} /></div>
            <div><span className="v num">{s.data.plans.filter(p => p.status === 'prevu' && Date.parse(p.end) > now).length}</span> <span className="small muted">à venir</span></div>
            <Link to="/particulier/planning" className="xs" style={{ color: 'var(--sage)' }}>Voir le planning</Link>
          </div>
          <div className="card p-tile">
            <div className="between" style={{ color: 'var(--teal)' }}><span className="p-label" style={{ textTransform: 'uppercase', color: 'var(--sage)' }}>Automatisation</span><Icon name="water_drop" size={18} /></div>
            <div className="p-title" style={{ fontSize: 16 }}>Pilotage non configuré</div>
            <span className="pill ghost" style={{ justifySelf: 'start' }}>Rappels uniquement</span>
          </div>
        </div>
      </section>

      <div className="p-quote"><Icon name="wb_twilight" /><span>« Consommer quand le réseau est le plus propre, sans renoncer à ce qui compte. »</span></div>
      {adding && <AddDeviceFlow onClose={() => setAdding(false)} />}
    </>
  );
}

function HeroCard({ r, onPlan, done }: { r: DeviceReco; onPlan: (o: Option) => void; done: boolean }) {
  const s = useStore();
  const o = r.reco!.best!, ref = r.reco!.reference;
  const cat = categoryOf(s.categories, r.device.categoryId);
  const priceInfo = o.costEur.value !== undefined;
  return (
    <section className="card p-hero" aria-labelledby="hero-title">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'grid' }}>
          <span className="p-label" style={{ textTransform: 'uppercase', color: 'var(--sage)', letterSpacing: '.1em' }}>Recommandation du moment</span>
          <h2 id="hero-title" className="p-h2" style={{ marginTop: 2 }}>{r.device.name}</h2>
          <span className="small" style={{ color: 'var(--ink-2)' }}>{[r.device.cycleMinutes && `Cycle ~${Math.round(r.device.cycleMinutes / 60 * 10) / 10} h`, r.device.powerKw && `${r.device.powerKw.toLocaleString('fr-FR')} kW`].filter(Boolean).join(' • ')}</span>
        </div>
        <span className="p-iconbtn"><Icon name={cat?.icon ?? 'devices_other'} fill /></span>
      </div>

      <div className="p-when">
        <div className="between">
          <span className="row"><Icon name={inRanges(parisParts(new Date(o.start)).hour, [[22, 6]]) ? 'nights_stay' : 'wb_sunny'} size={18} className="" /><span className="p-title">{fmt.slots(o.slots)}</span></span>
          <span className="pill sage">{fmt.rel(o.start)}</span>
        </div>
        <div className="p-metrics">
          <div className="p-metric">
            <span className="xs muted">Impact carbone</span>
            {r.reco!.avoidedCo2g?.value !== undefined ? <>
              <span><span className="v num">{fmt.co2(Math.max(0, r.reco!.avoidedCo2g.value))}</span> <span className="small" style={{ color: 'var(--sage)', fontWeight: 500 }}>CO₂ évités</span></span>
              <span className="xs" style={{ color: 'var(--sage)' }}>vs {fmt.hour(ref!.start)} habituellement</span>
            </> : <>
              <span><span className="v num">{fmt.co2(o.co2g.value!)}</span> <span className="small muted">CO₂ émis</span></span>
              <span className="xs muted">Indiquez votre heure habituelle pour estimer le gain</span>
            </>}
            <DatumBadge d={o.co2g} demo={r.device.origin === 'demo'} />
          </div>
          <div className="p-metric">
            <span className="xs muted">Bénéfice estimé</span>
            {r.reco!.savedEur?.value !== undefined ? <>
              <span><span className="v num">{fmt.eur(r.reco!.savedEur.value)}</span> <span className="small muted">économisés</span></span>
              <DatumBadge d={r.reco!.savedEur} />
            </> : priceInfo ? <>
              <span><span className="v num">{fmt.eur(o.costEur.value!)}</span> <span className="small muted">coût du cycle</span></span>
              <DatumBadge d={o.costEur} />
            </> : <Link to="/particulier/reglages" className="xs" style={{ color: 'var(--sage)' }}>Renseignez votre contrat pour afficher les coûts</Link>}
          </div>
        </div>
      </div>

      <p className="p-why"><Icon name="nature_people" />
        <span><strong style={{ fontWeight: 500, color: 'var(--primary)' }}>Pourquoi ce créneau ?</strong> Le réseau devrait y être à environ {Math.round(o.intensity)} g CO₂/kWh
          {ref ? `, contre ${Math.round(ref.intensity)} à votre heure habituelle` : ''}. C’est le plus bas carbone avant votre échéance
          {priceInfo ? ' ; à émissions comparables, nous retenons le moins cher' : ''}.</span>
      </p>

      <div className="p-actions">
        <button type="button" className="btn primary" onClick={() => onPlan(o)} disabled={done}><Icon name={done ? 'check' : 'schedule'} size={20} />{done ? 'Rappel enregistré' : 'Planifier ce créneau'}</button>
        <a href="#alternatives" className="btn ghost">Explorer les alternatives</a>
      </div>
    </section>
  );
}

function AltCard({ o, best, letter, onPick }: { o: Option; best: Option; letter: string; onPick: () => void }) {
  const night = inRanges(parisParts(new Date(o.start)).hour, [[22, 6]]);
  const dCo2 = o.co2g.value! - best.co2g.value!;
  const dCost = o.costEur.value !== undefined && best.costEur.value !== undefined ? o.costEur.value - best.costEur.value : undefined;
  return (
    <div className="card p-option">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'grid' }}>
          <span className="p-option-kicker" style={{ color: night ? 'var(--ink-2)' : 'var(--amber)' }}><Icon name={night ? 'nights_stay' : 'light_mode'} size={16} />Option {letter} • {night ? 'Nuit' : 'Journée'}</span>
          <span className="p-title">{fmt.rel(o.start)}, {fmt.slots(o.slots)}</span>
        </div>
        <DatumBadge d={o.co2g} />
      </div>
      <div className="row small wrap" style={{ color: 'var(--ink-2)', gap: 14 }}>
        <span className="row" style={{ color: 'var(--sage)', fontWeight: 500, gap: 4 }}><Icon name="eco" size={16} />{fmt.co2(o.co2g.value!)} CO₂ ({dCo2 >= 0 ? '+' : '−'}{fmt.co2(Math.abs(dCo2))})</span>
        {dCost !== undefined && <span>{dCost <= 0 ? `${fmt.eur(-dCost)} de moins` : `${fmt.eur(dCost)} de plus`}</span>}
      </div>
      <div className="between">
        <p className="xs muted italic">≈ {Math.round(o.intensity)} g CO₂/kWh sur ce créneau.</p>
        <button type="button" className="btn soft sm" onClick={onPick}>Choisir</button>
      </div>
    </div>
  );
}

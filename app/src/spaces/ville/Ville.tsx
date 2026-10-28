// Simulateur de scénario (ancien prototype) : quartier ENTIÈREMENT FICTIF.
// Accessible depuis l'espace Collectivité, présenté comme une simulation.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CAP, SCENARIOS, euro, kw, label, pct, rangeText, tarif, SLOTS, type ScenarioId } from '../../engine';
import { quartierSim, kWcOf, type SimOptions, type QuartierResult } from '../../engine/quartier';
import { MUNI, planMuni, bornesAt } from '../../engine/municipal';
import { DemoBadge, Icon, Kpi, LegalFooter, Logo, ScenarioChips, Switch } from '../../ui/ui';
import QuartierChart, { ChartLegend } from './QuartierChart';
import './ville.css';

// La 3D n'est téléchargée que si l'espace Ville est affiché.
const CityScene = lazy(() => import('./CityScene'));

export default function Ville() {
  const [scenario, setScenario] = useState<ScenarioId>('ete');
  const [cloud, setCloud] = useState(false);
  const [coord, setCoord] = useState(true);
  const [w, setW] = useState(.35);
  const [sim, setSim] = useState<SimOptions>({ ecole: true, boulangerie: true, parking: false });
  const [slot, setSlot] = useState(10); // 13h
  const [playing, setPlaying] = useState(false);

  const on = useMemo(() => quartierSim({ scenario, cloud, w, sim }, true), [scenario, cloud, w, sim]);
  const off = useMemo(() => quartierSim({ scenario, cloud, w, sim }, false), [scenario, cloud, w, sim]);
  const muni = useMemo(() => planMuni(on, w), [on, w]);
  const q = coord ? on : off;

  // Lecture : 2 créneaux (1 h) par seconde, comme dans l'application de base
  const tf = useRef(slot);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      tf.current = (tf.current + dt * 2) % SLOTS;
      setSlot(Math.floor(tf.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const prod = q.prod[slot], cons = q.cons[slot], loc = Math.min(prod, cons);
  const sc = SCENARIOS[scenario];

  return (
    <div className="space theme-ville ville">
      <header className="v-top">
        <div className="v-brand">
          <Logo sub="Simulateur" />
          <div className="v-where">
            <span className="eyebrow">Simulation · aucune donnée réelle</span>
            <strong>Quartier fictif · 30 foyers simulés, école, boulangerie, gymnase solaire</strong>
          </div>
        </div>
        <div className="v-top-actions">
          <DemoBadge />
          <Link className="btn sm" to="/collectivite/ville3d"><Icon name="arrow_back" size={18} />Retour à la carte réelle</Link>
        </div>
      </header>

      <main className="v-main">
        {/* ---------- Jumeau numérique ---------- */}
        <section className="v-hero" aria-labelledby="twin-title">
          <div className="v-scene card">
            <h1 id="twin-title" className="sr-only">Jumeau numérique du quartier</h1>
            <div className="v-scene-canvas">
              <Suspense fallback={<div className="v-scene-fallback" role="status">Chargement de la vue 3D…</div>}>
                <CityScene q={q} slot={slot} scenario={scenario} cloud={cloud} />
              </Suspense>
            </div>
            <div className="v-hud" aria-live="polite">
              <span className="v-clock num">{label(slot)}</span>
              <span className="sun">Soleil<b className="num">{kw(prod)}</b></span>
              <span>Conso<b className="num">{kw(cons)}</b></span>
              <span className="sun">Local<b className="num">{cons ? pct(loc / cons) : '–'}</b></span>
              <span className="grid">Réseau<b className="num">{kw(cons - loc)}</b></span>
            </div>
            <div className="v-legend">
              <span><i className="p sun" />Soleil du gymnase</span>
              <span><i className="p grid" />Électricité du réseau</span>
              <DemoBadge>Quartier simulé</DemoBadge>
            </div>
            <div className="v-time">
              <button type="button" className="btn small" aria-pressed={playing} onClick={() => { tf.current = slot; setPlaying(p => !p); }}>
                <Icon name={playing ? 'pause' : 'play_arrow'} size={18} />{playing ? 'Pause' : 'Lecture'}
              </button>
              <label className="sr-only" htmlFor="v-hour">Heure simulée</label>
              <input id="v-hour" type="range" min={0} max={SLOTS - 1} value={slot}
                onChange={e => { setPlaying(false); setSlot(+e.target.value); tf.current = +e.target.value; }}
                aria-valuetext={label(slot)} />
              <span className="num muted" style={{ minWidth: 92, textAlign: 'right' }}>8h → 8h demain</span>
            </div>
          </div>

          <aside className="v-side">
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Type de journée</div>
              <ScenarioChips value={scenario} onChange={setScenario} />
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Tarif Tempo réel : heures pleines {tarif(sc.hp)}, heures creuses {tarif(sc.hc)}.
              </p>
            </div>
            <div className="card v-controls">
              <Switch checked={coord} onChange={setCoord}><strong>Coordination Le Bon Moment</strong></Switch>
              <button type="button" className="btn" aria-pressed={cloud} onClick={() => setCloud(c => !c)}>
                <Icon name="cloud" size={18} />{cloud ? 'Retirer le nuage' : 'Un nuage arrive (11h30–15h30)'}
              </button>
              <div className="field">
                <label htmlFor="v-w">Priorité du quartier : économies ↔ écologie</label>
                <input id="v-w" type="range" min={0} max={100} value={Math.round(w * 100)} onChange={e => setW(+e.target.value / 100)}
                  aria-valuetext={w < .34 ? 'économies' : w > .66 ? 'écologie' : 'équilibre'} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted"><span>Économies</span><span>Écologie</span></div>
              </div>
            </div>
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Sur la journée</div>
              <div className="v-compare">
                <div><span className="muted">Autoconsommation</span><b className="num">{pct(off.taux)} <Icon name="arrow_forward" size={16} /> <em className="sun">{pct(on.taux)}</em></b></div>
                <div><span className="muted">Pic sur le poste</span><b className="num">{kw(off.peak)} <Icon name="arrow_forward" size={16} /> <em className={on.peak > CAP ? 'bad' : 'ok'}>{kw(on.peak)}</em></b></div>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Sans coordination → avec Le Bon Moment. Capacité du poste : {CAP} kW.</p>
            </div>
            <Alerts on={on} off={off} scenario={scenario} cloud={cloud} />
          </aside>
        </section>

        <section className="card" aria-labelledby="chart-title">
          <div className="card-head">
            <h2 id="chart-title">Production et consommation du quartier</h2>
            <DemoBadge />
          </div>
          <QuartierChart on={on} off={off} coord={coord} slot={slot} />
          <div style={{ marginTop: 10 }}><ChartLegend /></div>
        </section>

        {/* ---------- Tableau de bord Mairie ---------- */}
        <section aria-labelledby="mairie-title" className="v-section">
          <div className="v-section-head">
            <div>
              <div className="eyebrow">Tableau de bord de l'opération</div>
              <h2 id="mairie-title">Opération solaire du gymnase · {kWcOf(sim)} kWc</h2>
            </div>
            <DemoBadge />
          </div>
          <div className="kpis">
            <Kpi hl label="Taux d'autoconsommation" value={pct(on.taux)} sub={`contre ${pct(off.taux)} sans coordination`} />
            <Kpi label="Pic sur le poste" value={kw(on.peak)} sub={`contre ${kw(off.peak)} · capacité ${CAP} kW`} />
            <Kpi label="Économies du quartier" value={euro(off.cost - on.cost)} sub="sur cette journée" />
            <Kpi label="CO₂ évité" value={((off.co2 - on.co2) / 1000).toFixed(1).replace('.', ',') + ' kg'} sub="sur cette journée" />
          </div>

          <div className="v-grid">
            <div className="card">
              <div className="card-head"><h3>Bilan de la journée</h3></div>
              <table className="v-table">
                <thead><tr><th scope="col"><span className="sr-only">Indicateur</span></th><th scope="col">Sans</th><th scope="col">Avec</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Production solaire</th><td>{on.P.toFixed(0)} kWh</td><td>{on.P.toFixed(0)} kWh</td></tr>
                  <tr><th scope="row">Soleil consommé sur place</th><td>{off.local.toFixed(0)} kWh</td><td className="good">{on.local.toFixed(0)} kWh</td></tr>
                  <tr><th scope="row">Taux d'autoconsommation</th><td>{pct(off.taux)}</td><td className="good">{pct(on.taux)}</td></tr>
                  <tr><th scope="row">Pic de consommation</th><td>{kw(off.peak)}</td><td className="good">{kw(on.peak)}</td></tr>
                  <tr><th scope="row">Facture du quartier</th><td>{euro(off.cost)}</td><td className="good">{euro(on.cost)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-head"><h3>Simulateur</h3><span className="muted" style={{ fontSize: 12 }}>Et si… ?</span></div>
              <div className="v-sim">
                <Switch checked={sim.ecole} onChange={v => setSim(s => ({ ...s, ecole: v }))}>École Jules-Ferry participe</Switch>
                <Switch checked={sim.boulangerie} onChange={v => setSim(s => ({ ...s, boulangerie: v }))}>La boulangerie participe</Switch>
                <Switch checked={sim.parking} onChange={v => setSim(s => ({ ...s, parking: v }))}>Ombrières solaires du parking (+30 kWc)</Switch>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Chaque changement relance le calcul complet du quartier.</p>
            </div>

            <div className="card">
              <div className="card-head"><h3>Bâtiments municipaux</h3><span className="pill teal">Planifiés</span></div>
              <ul className="v-list">
                {MUNI.map((t, k) => (
                  <li key={t.name}><span>{t.name}</span><span className="num">{rangeText(muni[k])}</span></li>
                ))}
              </ul>
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Placés sur le soleil restant, une fois les habitants servis.</p>
            </div>

            <div className="card">
              <div className="card-head"><h3>Bornes publiques</h3><span className="eyebrow num">à {label(slot)}</span></div>
              <div className="v-bornes">
                {bornesAt(on, slot).map(b => (
                  <div key={b.name} className="v-borne">
                    <b>{b.name}</b>
                    <span className="muted" style={{ fontSize: 12 }}>{b.free} place{b.free > 1 ? 's' : ''} libre{b.free > 1 ? 's' : ''}</span>
                    <span className="num">{pct(b.local)} soleil local</span>
                    <span className="meter"><i style={{ width: Math.round(b.local * 100) + '%' }} /></span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Places libres et part de soleil : approximations de démonstration.</p>
            </div>
          </div>
        </section>

        {/* ---------- Smart city ---------- */}
        <SmartCity on={on} off={off} slot={slot} kWc={kWcOf(sim)} />
      </main>
      <LegalFooter />
    </div>
  );
}

// ---------- Alertes réseau : calculées à partir des résultats du moteur ----------
function Alerts({ on, off, scenario, cloud }: { on: QuartierResult; off: QuartierResult; scenario: ScenarioId; cloud: boolean }) {
  const items: { level: 'bad' | 'warn' | 'ok'; icon: string; text: string }[] = [];
  const offPeakSlot = off.cons.indexOf(off.peak);
  if (on.peak > CAP) items.push({ level: 'bad', icon: 'warning', text: `Le poste dépasse sa capacité même avec la coordination : ${kw(on.peak)} pour ${CAP} kW.` });
  if (off.peak > CAP) items.push({ level: on.peak > CAP ? 'warn' : 'ok', icon: 'bolt', text: `Sans coordination, le poste monterait à ${kw(off.peak)} vers ${label(offPeakSlot)}. Avec Le Bon Moment : ${kw(on.peak)}.` });
  if (scenario === 'rouge') items.push({ level: 'warn', icon: 'calendar_today', text: `Jour rouge Tempo : ${tarif(SCENARIOS.rouge.hp)} en heures pleines (6h–22h).` });
  if (scenario !== 'ete') items.push({ level: 'warn', icon: 'trending_up', text: 'Tension réseau attendue entre 18h et 20h (courbe simulée).' });
  if (cloud) items.push({ level: 'warn', icon: 'cloud', text: 'Passage nuageux de 11h30 à 15h30 : production divisée par 3, plannings recalculés.' });
  if (!items.length) items.push({ level: 'ok', icon: 'check_circle', text: 'Aucune alerte : le réseau du quartier est calme.' });
  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 10 }}><h3>Alertes réseau</h3><span className="pill">{items.length}</span></div>
      <ul className="v-alerts">
        {items.map((a, k) => <li key={k} className={a.level}><Icon name={a.icon} size={18} /><span>{a.text}</span></li>)}
      </ul>
    </div>
  );
}

// ---------- Vue d'ensemble de la ville (données de démonstration) ----------
// Seule l'opération Quartier simulé est calculée par le moteur. Les autres sont des exemples fictifs.
const OTHER_OPS = [
  { name: 'Îlot des Tilleuls', type: 'Bailleur social', foyers: 64, kWc: 120, taux: .71, peak: 82, cap: 100, status: 'Active' },
  { name: 'Résidence Les Vergers', type: 'Copropriété', foyers: 38, kWc: 60, taux: .64, peak: 49, cap: 60, status: 'Active' },
  { name: 'ZAC des Glycines', type: 'Projet municipal', foyers: 120, kWc: 250, taux: null, peak: null, cap: 160, status: 'En étude' },
] as const;

function SmartCity({ on, off, slot, kWc }: { on: QuartierResult; off: QuartierResult; slot: number; kWc: number }) {
  const co2Day = (off.co2 - on.co2) / 1000;
  const loc = Math.min(on.prod[slot], on.cons[slot]);
  const grid = on.cons[slot] - loc;
  return (
    <section aria-labelledby="city-title" className="v-section">
      <div className="v-section-head">
        <div>
          <div className="eyebrow">Simulation multi-quartiers</div>
          <h2 id="city-title">Vue d'ensemble de la ville</h2>
        </div>
        <DemoBadge>Opérations fictives · simulation</DemoBadge>
      </div>

      <div className="v-grid v-grid-city">
        <div className="card">
          <div className="card-head"><h3>Opérations d'autoconsommation</h3><span className="muted" style={{ fontSize: 12 }}>4 sites</span></div>
          <div className="v-table-wrap">
            <table className="v-table v-ops">
              <thead><tr><th scope="col">Opération</th><th scope="col">Foyers</th><th scope="col">Solaire</th><th scope="col">Autoconso.</th><th scope="col">Pic / capacité</th><th scope="col">Statut</th></tr></thead>
              <tbody>
                <tr className="live">
                  <th scope="row">Quartier simulé<small>Gymnase · calculé par le moteur</small></th>
                  <td>30</td><td>{kWc} kWc</td><td className="sun">{pct(on.taux)}</td>
                  <td className={on.peak > CAP ? 'bad' : ''}>{kw(on.peak)} / {CAP}</td>
                  <td><span className="pill teal"><span className="dot pulse" />En direct</span></td>
                </tr>
                {OTHER_OPS.map(o => (
                  <tr key={o.name}>
                    <th scope="row">{o.name}<small>{o.type} · exemple fictif</small></th>
                    <td>{o.foyers}</td><td>{o.kWc} kWc</td>
                    <td>{o.taux === null ? '–' : pct(o.taux)}</td>
                    <td>{o.peak === null ? '–' : `${o.peak} / ${o.cap}`}</td>
                    <td><span className={'pill' + (o.status === 'Active' ? ' sage' : '')}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Carte des flux d'énergie</h3><span className="eyebrow num">à {label(slot)}</span></div>
          <FluxMap local={loc} grid={grid} />
        </div>

        <div className="card">
          <div className="card-head"><h3>Indicateurs climat</h3></div>
          <div className="v-climate">
            <div><span className="eyebrow">CO₂ évité aujourd'hui</span><b className="num">{co2Day.toFixed(1).replace('.', ',')} kg</b><small className="muted">Quartier simulé, moteur</small></div>
            <div><span className="eyebrow">Soleil consommé sur place</span><b className="num">{on.local.toFixed(0)} kWh</b><small className="muted">sur {on.P.toFixed(0)} kWh produits</small></div>
            <div><span className="eyebrow">Projection sur 30 jours</span><b className="num">{(co2Day * 30).toFixed(0)} kg CO₂</b><small className="muted">journée simulée × 30, indicatif</small></div>
            <div><span className="eyebrow">Économies sur 30 jours</span><b className="num">{euro((off.cost - on.cost) * 30)}</b><small className="muted">journée simulée × 30, indicatif</small></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FluxMap({ local, grid }: { local: number; grid: number }) {
  // Schéma (pas une vraie carte). Quartier simulé suit le moteur ; les autres sites sont fictifs et figés.
  const sites = [
    { id: 'cdc', name: 'Quartier simulé', x: 210, y: 170, live: true },
    { id: 'til', name: 'Îlot des Tilleuls', x: 390, y: 110, live: false },
    { id: 'ver', name: 'Les Vergers', x: 420, y: 250, live: false },
    { id: 'gly', name: 'ZAC des Glycines', x: 120, y: 280, live: false },
  ];
  const poste = { x: 540, y: 60 };
  const gw = (v: number) => Math.max(1.5, Math.min(10, v / 6));
  return (
    <svg className="chart v-flux" viewBox="0 0 600 330" role="img"
      aria-label={`Schéma des flux : Quartier simulé consomme ${kw(local)} de soleil local et ${kw(grid)} du réseau`}>
      <rect x="10" y="10" width="580" height="310" rx="14" fill="var(--subtle)" />
      {[60, 120, 180, 240, 300].map(y => <line key={y} x1="10" x2="590" y1={y} y2={y} stroke="var(--border)" />)}
      {[100, 200, 300, 400, 500].map(x => <line key={x} y1="10" y2="320" x1={x} x2={x} stroke="var(--border)" />)}
      {sites.map(s => (
        <line key={s.id} x1={poste.x} y1={poste.y} x2={s.x} y2={s.y} stroke="var(--teal)"
          strokeWidth={s.live ? gw(grid) : 2} strokeDasharray="6 6" opacity={s.live ? .9 : .35} className="flow" />
      ))}
      <g>
        <rect x={poste.x - 22} y={poste.y - 16} width="44" height="32" rx="6" fill="var(--card)" stroke="var(--teal)" />
        <text x={poste.x} y={poste.y + 5} textAnchor="middle" fontSize="16" className="ms" fill="var(--teal)">bolt</text>
        <text x={poste.x} y={poste.y + 32} textAnchor="middle" fontSize="11" fill="var(--muted)">Réseau</text>
      </g>
      {sites.map(s => {
        const r = s.live ? 14 + Math.min(26, local / 2.5) : 16;
        return (
          <g key={s.id}>
            <circle cx={s.x} cy={s.y} r={r} fill="var(--amber)" opacity={s.live ? .28 : .1} />
            <circle cx={s.x} cy={s.y} r="9" fill={s.live ? 'var(--amber)' : 'var(--card)'} stroke="var(--amber)" />
            <text x={s.x} y={s.y + r + 16} textAnchor="middle" fontSize="12" fill="var(--ink-2)">{s.name}</text>
            {s.live && <text x={s.x} y={s.y - r - 8} textAnchor="middle" fontSize="12" fill="var(--amber)">Soleil local {kw(local)} · réseau {kw(grid)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

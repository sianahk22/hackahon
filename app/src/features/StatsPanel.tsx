// Statistiques détaillées (entreprise, collectivité). Tout est calculé à partir des relevés
// réellement enregistrés pour la sélection courante ; aucune valeur n'est inventée.
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { aggregate, anomalies, series, type Dimension, type Period } from '../core/stats';
import { toCsv, download } from '../core/csv';
import type { Reading } from '../core/types';
import { DatumBadge, EmptyState, Icon, fmt } from '../ui/ui';
import { AreaChart, Bars } from './charts';
import { useCarbonForReadings } from './bilan';

const DIMS: { k: Dimension; l: string }[] = [
  { k: 'equipement', l: 'Équipement' }, { k: 'categorie', l: 'Catégorie' }, { k: 'batiment', l: 'Bâtiment' }, { k: 'zone', l: 'Zone / quartier' }, { k: 'site', l: 'Site' },
];
const SPANS: { k: string; l: string; days: number; step: Period }[] = [
  { k: '7j', l: '7 jours', days: 7, step: 'jour' }, { k: '30j', l: '30 jours', days: 30, step: 'jour' },
  { k: '12m', l: '12 mois', days: 365, step: 'mois' }, { k: 'tout', l: 'Tout', days: 36500, step: 'mois' },
];

export default function StatsPanel({ deviceIds, scopeLabel, dims = DIMS.map(d => d.k) }: { deviceIds?: Set<string>; scopeLabel: string; dims?: Dimension[] }) {
  const s = useStore();
  const [dim, setDim] = useState<Dimension>(dims[0]), [span, setSpan] = useState('30j');
  const sp = SPANS.find(x => x.k === span)!;
  const now = Date.now(), from = now - sp.days * 864e5, prevFrom = from - sp.days * 864e5;

  const inScope = useMemo(() => s.data.readings.filter(r => !deviceIds || (r.deviceId && deviceIds.has(r.deviceId))), [s.data.readings, deviceIds]);
  const cur = useMemo(() => inScope.filter(r => Date.parse(r.start) >= from), [inScope, from]);
  const prev = useMemo(() => inScope.filter(r => Date.parse(r.start) >= prevFrom && Date.parse(r.start) < from), [inScope, from, prevFrom]);
  const carbon = useCarbonForReadings(cur);
  const L = { devices: s.data.devices, categories: s.categories, buildings: s.data.buildings, zones: s.data.zones, sites: s.data.sites };
  const rows = useMemo(() => aggregate(cur, dim, L, carbon.model), [cur, dim, carbon.model, s.data.devices, s.data.buildings, s.data.zones, s.data.sites]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = useMemo(() => aggregate(cur, 'equipement', L).slice(0, 5), [cur, s.data.devices]); // eslint-disable-line react-hooks/exhaustive-deps
  const anoms = useMemo(() => anomalies(inScope.filter(r => Date.parse(r.start) >= now - 90 * 864e5), L), [inScope, s.data.devices]); // eslint-disable-line react-hooks/exhaustive-deps

  const kWh = cur.reduce((a, r) => a + r.kWh, 0), kWhPrev = prev.reduce((a, r) => a + r.kWh, 0);
  // Comparaison seulement si la période précédente est couverte par autant de relevés (±10 %).
  const comparable = cur.length > 0 && prev.length >= cur.length * .9 && prev.length <= cur.length * 1.1;
  const co2 = rows.reduce((a, r) => a + (r.co2kg ?? 0), 0);
  const coverage = rows.reduce((a, r) => a + r.kWh * r.co2Coverage, 0) / (kWh || 1);
  const scopeDevices = s.data.devices.filter(d => !deviceIds || deviceIds.has(d.id));
  const measured = new Set(cur.map(r => r.deviceId));
  const unmeasured = scopeDevices.filter(d => !measured.has(d.id));
  const demo = cur.some(r => r.source === 'demo');
  const pts = series(cur, sp.step).map(p => ({ k: p.k, v: p.kWh }));

  const exportRows = () => download(`statistiques-${dim}-${span}.csv`, toCsv(rows.map(r => ({
    [DIMS.find(d => d.k === dim)!.l]: r.label, kwh: r.kWh.toFixed(3).replace('.', ','), co2_kg_estime: r.co2kg !== undefined ? r.co2kg.toFixed(3).replace('.', ',') : '', couverture_co2: Math.round(r.co2Coverage * 100) + ' %', releves: r.n,
  }))));
  const exportRaw = () => download(`releves-${span}.csv`, toCsv(cur.map((r: Reading) => ({
    debut: r.start, fin: r.end, kwh: String(r.kWh).replace('.', ','), equipement: s.data.devices.find(d => d.id === r.deviceId)?.name ?? 'Compteur', source: r.source,
  }))));

  return (
    <section className="stats stack" aria-label={`Statistiques : ${scopeLabel}`} style={{ gap: 16 }}>
      <div className="between wrap">
        <div><span className="eyebrow">Sélection</span><h2 style={{ fontSize: 22 }}>{scopeLabel}</h2></div>
        <div className="row wrap">
          <label className="field" style={{ minWidth: 140 }}><span className="sr-only">Période</span>
            <select value={span} onChange={e => setSpan(e.target.value)}>{SPANS.map(x => <option key={x.k} value={x.k}>{x.l}</option>)}</select></label>
          <label className="field" style={{ minWidth: 170 }}><span className="sr-only">Regrouper par</span>
            <select value={dim} onChange={e => setDim(e.target.value as Dimension)}>{DIMS.filter(d => dims.includes(d.k)).map(d => <option key={d.k} value={d.k}>Par {d.l.toLowerCase()}</option>)}</select></label>
          <button type="button" className="btn sm" onClick={exportRows} disabled={!rows.length}><Icon name="download" size={18} />Export agrégé</button>
          <button type="button" className="btn sm" onClick={exportRaw} disabled={!cur.length}><Icon name="table" size={18} />Relevés</button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-box">
          <div className="between"><span className="eyebrow">Consommation mesurée</span><DatumBadge d={{ status: cur.length ? 'mesure' : 'indisponible', source: 'Relevés enregistrés' }} demo={demo} /></div>
          <b className="num">{cur.length ? fmt.kwh(kWh) : '—'}</b>
          <span className="xs muted">{comparable ? `${kWh >= kWhPrev ? '+' : '−'}${Math.abs(Math.round((kWh - kWhPrev) / (kWhPrev || 1) * 100))} % vs période précédente (même durée)` : 'Pas de période précédente comparable (couverture des mesures insuffisante)'}</span>
        </div>
        <div className="kpi-box">
          <div className="between"><span className="eyebrow">Émissions estimées</span><DatumBadge d={{ status: coverage > 0 ? 'estimation' : 'indisponible', method: 'kWh mesurés × intensité éCO2mix du même quart d’heure' }} /></div>
          <b className="num">{coverage > 0 ? fmt.co2(co2 * 1000) : '—'}</b>
          <span className="xs muted">{carbon.status === 'chargement' ? 'Calcul en cours…' : coverage > 0 ? `Sur ${Math.round(coverage * 100)} % de l’énergie mesurée` : 'Intensité carbone indisponible pour ces dates'}</span>
        </div>
        <div className="kpi-box">
          <div className="between"><span className="eyebrow">Équipements mesurés</span></div>
          <b className="num">{scopeDevices.length - unmeasured.length} / {scopeDevices.length}</b>
          <span className="xs muted">{unmeasured.length ? `${unmeasured.length} sans mesure sur la période` : 'Tous mesurés'}</span>
        </div>
        <div className="kpi-box">
          <div className="between"><span className="eyebrow">Coûts</span><DatumBadge d={{ status: 'indisponible' }} /></div>
          <b className="num">—</b>
          <span className="xs muted">Nécessite les prix du contrat par site (réglages) et des relevés horaires ; non calculé ici.</span>
        </div>
      </div>

      {!cur.length ? (
        <EmptyState icon="query_stats" title="Aucune mesure pour cette sélection et cette période">
          Importez des relevés CSV depuis la fiche des équipements, ou connectez un système de comptage. Une absence de mesure n’est pas une consommation nulle.
        </EmptyState>
      ) : (
        <div className="stats-grid">
          <div className="card bordered stack">
            <h3 style={{ fontSize: 18 }}>Évolution</h3>
            <AreaChart points={pts} unit="kWh" label={`Évolution de la consommation mesurée, ${scopeLabel}`} />
          </div>
          <div className="card bordered stack">
            <h3 style={{ fontSize: 18 }}>Équipements les plus consommateurs</h3>
            <Bars rows={top.map(r => ({ label: r.label, v: r.kWh }))} unit="kWh" />
          </div>
          <div className="card bordered stack" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 18 }}>Par {DIMS.find(d => d.k === dim)!.l.toLowerCase()}</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{DIMS.find(d => d.k === dim)!.l}</th><th className="r">Consommation</th><th className="r">Part</th><th className="r">CO₂ estimé</th><th className="r">Relevés</th></tr></thead>
                <tbody>{rows.map(r => (
                  <tr key={r.key}><td>{r.label}</td><td className="r">{fmt.kwh(r.kWh)}</td><td className="r">{Math.round(r.kWh / kWh * 100)} %</td>
                    <td className="r">{r.co2kg !== undefined ? fmt.co2(r.co2kg * 1000) : <span className="muted">n.c.</span>}</td><td className="r">{r.n}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="card bordered stack">
          <div className="between"><h3 style={{ fontSize: 18 }}>Anomalies détectées</h3><span className="pill ghost">90 jours</span></div>
          {anoms.length === 0 ? <p className="small muted">Aucune anomalie. Méthode : un jour dépassant la moyenne de + 3 écarts-types, avec au moins 14 jours de mesures.</p> : (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{anoms.slice(0, 8).map(a => <li key={a.key + a.day}><b style={{ fontWeight: 500 }}>{a.label}</b> le {a.day} : {fmt.kwh(a.kWh)} (moyenne {fmt.kwh(a.mean)})</li>)}</ul>
          )}
        </div>
        <div className="card bordered stack">
          <h3 style={{ fontSize: 18 }}>Données manquantes</h3>
          {unmeasured.length === 0 ? <p className="small muted">Tous les équipements de la sélection ont des mesures sur la période.</p> : (
            <ul className="small" style={{ margin: 0, paddingLeft: 18, maxHeight: 160, overflow: 'auto' }}>{unmeasured.map(d => <li key={d.id}>{d.name}</li>)}</ul>
          )}
        </div>
      </div>
    </section>
  );
}

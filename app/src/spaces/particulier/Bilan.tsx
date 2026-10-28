import { useMemo, useState } from 'react';
import { useStore } from '../../data/store';
import { aggregate, series, total } from '../../core/stats';
import { parseReadingsCsv, toCsv, download } from '../../core/csv';
import { parisDayStart } from '../../core/tariffs';
import { DatumBadge, EmptyState, Icon, Missing, fmt } from '../../ui/ui';
import { AreaChart } from '../../features/charts';
import { categoryOf } from '../../features/devices';
import { forecastSavings, useCarbonForReadings } from '../../features/bilan';

type Range = 'jour' | 'mois' | 'tout';

export default function Bilan() {
  const s = useStore();
  const [range, setRange] = useState<Range>('mois'), [msg, setMsg] = useState('');
  const now = Date.now();
  const from = range === 'jour' ? parisDayStart(fmt.dayKey(now)) : range === 'mois' ? parisDayStart(fmt.dayKey(now).slice(0, 8) + '01') : 0;
  const readings = useMemo(() => s.data.readings.filter(r => Date.parse(r.start) >= from), [s.data.readings, from]);
  const plans = s.data.plans.filter(p => Date.parse(p.start) >= from);
  const carbon = useCarbonForReadings(readings);
  const lookups = { devices: s.data.devices, categories: s.categories, buildings: [], zones: [], sites: [] };
  const rows = useMemo(() => aggregate(readings, 'equipement', lookups, carbon.model), [readings, carbon.model, s.data.devices]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = total(readings);
  const co2 = rows.reduce((a, r) => a + (r.co2kg ?? 0), 0);
  const covered = rows.reduce((a, r) => a + r.kWh * r.co2Coverage, 0) / (tot.value || 1);
  const pts = series(readings, range === 'jour' ? 'jour' : range === 'mois' ? 'jour' : 'mois').map(p => ({ k: p.k, v: p.kWh }));
  const fc = forecastSavings(plans);
  const demo = readings.some(r => r.source === 'demo');

  const importMeter = async (f: File) => {
    const res = parseReadingsCsv(await f.text());
    if (res.rows.length) await s.importReadings(res.rows);
    setMsg(`${res.rows.length} relevé(s) importé(s) pour le compteur général.` + (res.errors.length ? ` ${res.errors.length} ligne(s) ignorée(s).` : ''));
  };
  const exportCsv = () => download(`bilan-${range}.csv`, toCsv(readings.map(r => ({
    debut: r.start, fin: r.end, kwh: String(r.kWh).replace('.', ','), equipement: s.data.devices.find(d => d.id === r.deviceId)?.name ?? 'Compteur général', source: r.source,
  }))));

  return (
    <>
      <section className="stack" style={{ gap: 2, marginTop: 8 }}>
        <span className="p-label" style={{ textTransform: 'uppercase', letterSpacing: '.2em', color: 'var(--sage)' }}>Énergie &amp; climat</span>
        <h1 className="p-h2 italic" style={{ fontSize: 30 }}>Votre Empreinte &amp; Progrès</h1>
      </section>

      <div className="p-tabs3" role="group" aria-label="Période">
        {([['jour', 'Aujourd’hui'], ['mois', 'Ce mois-ci'], ['tout', 'Historique global']] as const).map(([k, l]) =>
          <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
      </div>

      <section className="card stack" style={{ gap: 14, padding: 22 }}>
        <div className="between"><span className="p-label" style={{ textTransform: 'uppercase', color: 'var(--ink-2)' }}>Consommation mesurée</span><DatumBadge d={tot} demo={demo} /></div>
        {tot.value !== undefined ? <>
          <div><span className="p-big num">{fmt.kwh(tot.value).replace(' kWh', '')}</span> <span className="p-title" style={{ fontSize: 16, color: 'var(--sage)' }}>kWh</span></div>
          {pts.length > 1 && <AreaChart points={pts} unit="kWh" label="Évolution de la consommation mesurée" />}
        </> : <Missing d={tot} />}

        <div className="row" style={{ gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14, alignItems: 'flex-start' }}>
          <span className="p-iconbtn" style={{ background: 'var(--sage-wash)', color: 'var(--sage-ink)' }}><Icon name="cloud" size={18} /></span>
          <div style={{ display: 'grid', gap: 2 }}>
            <span className="small muted">Émissions associées</span>
            {tot.value === undefined ? <span className="small muted">Sans mesure de consommation, pas d’émissions calculables.</span>
              : carbon.status === 'chargement' ? <span className="small">Calcul à partir d’éCO2mix…</span>
              : carbon.status === 'erreur' ? <span className="small" style={{ color: 'var(--danger)' }}>Intensité carbone indisponible ({carbon.error}).</span>
              : covered > 0 ? <span className="p-title num">{fmt.co2(co2 * 1000)} CO₂ <DatumBadge d={{ status: 'estimation', method: 'kWh mesurés × intensité éCO2mix du même quart d’heure', source: 'Relevés + RTE éCO2mix' }} /></span>
              : <span className="small muted">Aucune intensité éCO2mix disponible pour ces dates (données temps réel depuis le 1er septembre 2026).</span>}
            {covered > 0 && covered < .99 && <span className="xs muted">Calculé sur {Math.round(covered * 100)} % de l’énergie mesurée.</span>}
          </div>
        </div>

        <div className="card soft row small" style={{ alignItems: 'flex-start', gap: 10, padding: 14, color: 'var(--ink-2)' }}>
          <Icon name="verified" size={18} />
          <span>Consommation : vos relevés importés. Émissions : estimation à partir de l’intensité carbone publiée par RTE (éCO2mix), moyenne nationale.</span>
        </div>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <div className="between"><h2 className="p-h3 italic">Économies</h2><span className="xs muted">{fc.n} usage{fc.n > 1 ? 's' : ''} planifié{fc.n > 1 ? 's' : ''}</span></div>
        <div className="card stack" style={{ gap: 10 }}>
          <div className="between"><span className="p-title" style={{ fontSize: 16 }}>Prévisionnelles</span><DatumBadge d={{ status: 'estimation', method: 'Écart entre l’heure habituelle et le créneau planifié, calculé à la planification' }} /></div>
          {fc.co2g !== undefined || fc.eur !== undefined ? (
            <p className="small">{fc.co2g !== undefined && <>≈ <b style={{ fontWeight: 500 }}>{fmt.co2(fc.co2g)} de CO₂</b> évités ({fc.nCo2} usage{fc.nCo2 > 1 ? 's' : ''})</>}{fc.co2g !== undefined && fc.eur !== undefined && ' · '}{fc.eur !== undefined && <>≈ <b style={{ fontWeight: 500 }}>{fmt.eur(fc.eur)}</b> ({fc.nCost} usage{fc.nCost > 1 ? 's' : ''} avec prix connu)</>}</p>
          ) : <p className="small muted">Aucun usage planifié comparable à une heure habituelle sur cette période.</p>}
        </div>
        <div className="card stack" style={{ gap: 6 }}>
          <div className="between"><span className="p-title" style={{ fontSize: 16 }}>Constatées</span><DatumBadge d={{ status: 'indisponible' }} /></div>
          <p className="small muted">Pas encore calculables : il faut comparer votre consommation mesurée après changement d’habitudes à une période de référence mesurée avant, à usages et météo comparables. Cette méthode n’est pas encore implémentée.</p>
        </div>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <div className="between"><h2 className="p-h3 italic">Détail par usage</h2><span className="xs muted">{rows.length} poste{rows.length > 1 ? 's' : ''}</span></div>
        {rows.length === 0 ? (
          <EmptyState icon="query_stats" title="Aucune mesure sur cette période">Importez un relevé CSV (par appareil depuis sa fiche, ou pour le compteur général ci-dessous). Les données de votre compteur Linky sont téléchargeables depuis votre espace client Enedis.</EmptyState>
        ) : rows.map(r => {
          const d = s.data.devices.find(x => x.id === r.key);
          return (
            <div key={r.key} className="card p-usage">
              <span className="p-iconbtn" style={{ borderRadius: 'var(--r-sm)' }}><Icon name={d ? categoryOf(s.categories, d.categoryId)?.icon ?? 'devices_other' : 'electric_meter'} size={20} /></span>
              <div style={{ display: 'grid', flex: 1, minWidth: 0 }}><span className="p-title" style={{ fontSize: 17 }}>{r.label}</span><span className="xs muted">{r.n} relevé{r.n > 1 ? 's' : ''}</span></div>
              <div style={{ display: 'grid', justifyItems: 'end' }}><span className="p-title num" style={{ fontSize: 16 }}>{fmt.kwh(r.kWh)}</span><span className="xs" style={{ color: 'var(--sage)' }}>{r.co2kg !== undefined ? `${fmt.co2(r.co2kg * 1000)} CO₂` : 'CO₂ non calculable'}</span></div>
            </div>
          );
        })}
      </section>

      <div className="stack" style={{ gap: 8 }}>
        <label className="btn soft block" style={{ cursor: 'pointer' }}>
          <Icon name="electric_meter" size={20} />Importer un relevé du compteur général (CSV)
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) importMeter(f); e.target.value = ''; }} />
        </label>
        {msg && <p className="xs" role="status">{msg}</p>}
        <button type="button" className="btn primary block" onClick={exportCsv} disabled={!readings.length}><Icon name="article" size={20} />Exporter les données de la période (CSV)</button>
        <p className="row xs muted" style={{ justifyContent: 'center' }}><Icon name="lock" size={14} />{s.mode === 'local' ? 'Données conservées dans ce navigateur.' : 'Données isolées par compte (règles serveur).'}</p>
      </div>
    </>
  );
}

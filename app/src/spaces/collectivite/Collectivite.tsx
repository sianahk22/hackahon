// Espace Collectivité « Le Bon Moment Ville » : institutionnel et territorial.
import { useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../../data/store';
import { Banners } from '../../app/Shell';
import { fetchTerritory, searchCommunes } from '../../data/sources/public';
import { EmptyState, Icon, Logo } from '../../ui/ui';
import Inventory from '../../features/Inventory';
import StatsPanel from '../../features/StatsPanel';
import RecoBoard, { CarbonNow, PlansList } from '../../features/RecoBoard';
import Places from '../../features/Places';
import Settings from '../../features/Settings';
import Members from '../../features/Members';
import Villes3D from './Villes3D';
import LogoutButton from '../../app/LogoutButton';
import './collectivite.css';

const TABS = [
  { to: 'moments', label: 'Moments', icon: 'auto_awesome' },
  { to: 'ville3d', label: 'Villes 3D', icon: 'view_in_ar' },
  { to: 'appareils', label: 'Appareils', icon: 'devices' },
  { to: 'bilan', label: 'Bilan', icon: 'monitoring' },
];
const MORE = [
  { to: 'territoire', label: 'Quartiers et bâtiments', icon: 'domain' },
  { to: 'equipe', label: 'Équipe', icon: 'group' },
  { to: 'reglages', label: 'Réglages', icon: 'tune' },
];

export default function Collectivite() {
  const s = useStore();
  const active = s.org?.activation.status === 'active';
  return (
    <div className="space theme-collectivite c-shell">
      <header className="c-top">
        <div className="c-top-in">
          <div className="row" style={{ gap: 18 }}><Logo sub="Ville" /><span className="c-org">{s.org?.name}{s.org?.territory ? ` · ${s.org.territory.nom}` : ''}</span></div>
          <nav className="c-more" aria-label="Administration">{MORE.map(n => <NavLink key={n.to} to={n.to}><Icon name={n.icon} size={18} /><span>{n.label}</span></NavLink>)}<LogoutButton className="c-logout" /></nav>
        </div>
        <nav className="c-tabs" aria-label="Navigation principale">{TABS.map(n => <NavLink key={n.to} to={n.to}><Icon name={n.icon} size={20} /><span>{n.label}</span></NavLink>)}</nav>
      </header>
      <Banners />
      <main className="c-main">
        {!active || !s.org?.territory ? (
          <Routes>
            <Route path="reglages" element={<Settings />} />
            <Route path="equipe" element={<Members />} />
            <Route path="*" element={!active ? <ActivationGate /> : <TerritorySetup />} />
          </Routes>
        ) : (
          <Routes>
            <Route index element={<Navigate to="ville3d" replace />} />
            <Route path="moments" element={<>
              <h1>Moments</h1>
              <p className="small muted">Meilleurs créneaux pour les équipements municipaux déplaçables. Systèmes critiques et usages essentiels exclus. Sans intégration, les plans sont des rappels aux services : aucune commande n’est envoyée.</p>
              <CarbonNow /><RecoBoard /><h2>Usages planifiés</h2><PlansList />
            </>} />
            <Route path="ville3d" element={<Villes3D />} />
            <Route path="appareils" element={<Inventory title="Inventaire municipal" />} />
            <Route path="bilan" element={<><h1>Bilan municipal</h1><StatsPanel scopeLabel={`Ville entière · ${s.org.territory.nom}`} /></>} />
            <Route path="territoire" element={<><h1>Quartiers et bâtiments</h1><p className="small muted">Les bâtiments se localisent sur la carte (onglet Villes 3D) ; leur adresse officielle est récupérée dans la Base Adresse Nationale.</p><Places withSites={false} zoneLabel="Quartiers" /></>} />
            <Route path="equipe" element={<Members />} />
            <Route path="reglages" element={<Settings />} />
            <Route path="*" element={<Navigate to="ville3d" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function ActivationGate() {
  const s = useStore();
  return (
    <div className="card bordered stack" style={{ maxWidth: 720 }}>
      <Icon name="verified_user" size={28} />
      <h1>Activation de l’espace municipal requise</h1>
      <p className="small">L’espace municipal complet (carte du territoire, inventaire, bilans) est réservé aux collectivités habilitées. Votre organisation <b style={{ fontWeight: 500 }}>{s.org?.name}</b> est enregistrée et <b style={{ fontWeight: 500 }}>en attente d’activation</b>.</p>
      <p className="small muted">L’activation se fait après vérification administrative ou contractuelle par l’équipe Le Bon Moment. Aucun processus commercial n’est encore en place : en production, l’activation sera effectuée côté serveur uniquement.</p>
      {s.mode === 'local' ? (
        <div className="card soft stack">
          <p className="small"><b style={{ fontWeight: 500 }}>Mode local (démonstration) :</b> vous pouvez activer l’espace pour le tester. Cette activation n’a aucune valeur administrative ni contractuelle et reste dans ce navigateur.</p>
          <button type="button" className="btn primary" style={{ justifySelf: 'start' }} onClick={s.activateLocally}>Activer pour un test local</button>
        </div>
      ) : <p className="small">Contactez l’équipe Le Bon Moment pour lancer la vérification.</p>}
    </div>
  );
}

function TerritorySetup() {
  const s = useStore();
  const [q, setQ] = useState(''), [res, setRes] = useState<Awaited<ReturnType<typeof searchCommunes>>>([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const search = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { setRes(await searchCommunes(q)); } catch (x) { setErr(`Recherche impossible (${x instanceof Error ? x.message : x}).`); } finally { setBusy(false); }
  };
  const choose = async (code: string) => {
    setBusy(true); setErr('');
    try { const t = await fetchTerritory(code); await s.updateOrg({ ...s.org!, territory: t }); await s.log('Configuration du territoire', 'ok', t.nom); }
    catch (x) { setErr(`Contour indisponible (${x instanceof Error ? x.message : x}).`); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h1>Configurer votre territoire</h1>
      <EmptyState icon="travel_explore" title="Aucun territoire configuré">
        Choisissez votre commune : son contour officiel est récupéré auprès de geo.api.gouv.fr, et la carte 3D affiche les bâtiments réels issus d’OpenStreetMap. Aucune donnée géographique n’est inventée.
      </EmptyState>
      {s.role !== 'admin' ? <p className="small">Seul un administrateur peut configurer le territoire.</p> : <>
        <form className="row wrap" onSubmit={search} style={{ alignItems: 'end' }}>
          <label className="field" style={{ flex: 1, minWidth: 240 }}><span>Nom de la commune</span><input className="input" required minLength={2} value={q} onChange={e => setQ(e.target.value)} /></label>
          <button className="btn primary" disabled={busy}>Rechercher</button>
        </form>
        {err && <p role="alert" className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
        {res.length > 0 && <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }}>{res.map(c => (
          <li key={c.code}><button type="button" className="card bordered between" style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => choose(c.code)} disabled={busy}>
            <span><b style={{ fontWeight: 500 }}>{c.nom}</b> <span className="small muted">({c.codeDepartement}) · INSEE {c.code}{c.population ? ` · ${c.population.toLocaleString('fr-FR')} hab.` : ''}</span></span><Icon name="chevron_right" />
          </button></li>
        ))}</ul>}
      </>}
    </div>
  );
}

// Espace Entreprise : univers professionnel, multi-sites, orienté données.
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../../data/store';
import { Banners } from '../../app/Shell';
import { Icon, Logo, fmt } from '../../ui/ui';
import Inventory from '../../features/Inventory';
import StatsPanel from '../../features/StatsPanel';
import RecoBoard, { CarbonNow, PlansList } from '../../features/RecoBoard';
import Places from '../../features/Places';
import Settings from '../../features/Settings';
import Members from '../../features/Members';
import LogoutButton from '../../app/LogoutButton';
import './entreprise.css';

const NAV = [
  { to: 'tableau', label: 'Tableau de bord', icon: 'space_dashboard' },
  { to: 'planification', label: 'Planification', icon: 'event_upcoming' },
  { to: 'inventaire', label: 'Inventaire', icon: 'inventory_2' },
  { to: 'bilans', label: 'Bilans', icon: 'monitoring' },
  { to: 'sites', label: 'Sites et zones', icon: 'domain' },
  { to: 'equipe', label: 'Équipe', icon: 'group' },
  { to: 'reglages', label: 'Réglages', icon: 'tune' },
];

export default function Entreprise() {
  const s = useStore();
  return (
    <div className="space theme-entreprise e-shell">
      <aside className="e-side" aria-label="Navigation de l’espace entreprise">
        <div className="e-brand"><Logo sub="Entreprise" /></div>
        <div className="e-org"><span className="eyebrow">Organisation</span><b>{s.org?.name}</b><span className="xs muted">Connecté : {s.account?.displayName} · rôle {s.role}</span><LogoutButton className="btn sm e-logout" /></div>
        <nav className="e-nav">{NAV.map(n => <NavLink key={n.to} to={n.to}><Icon name={n.icon} size={20} /><span>{n.label}</span></NavLink>)}</nav>
      </aside>
      <div className="e-body">
        <Banners />
        <main className="e-main">
          <Routes>
            <Route index element={<Navigate to="tableau" replace />} />
            <Route path="tableau" element={<Dashboard />} />
            <Route path="planification" element={<>
              <h1 style={{ fontSize: 28 }}>Planification</h1>
              <p className="small muted">Créneaux les plus bas carbone avant l’échéance de chaque équipement, puis les moins chers parmi eux. Sans intégration, un plan crée un rappel : aucune commande n’est envoyée.</p>
              <CarbonNow /><RecoBoard /><h2 style={{ fontSize: 22 }}>Usages planifiés</h2><PlansList />
            </>} />
            <Route path="inventaire" element={<Inventory />} />
            <Route path="bilans" element={<><h1 style={{ fontSize: 28 }}>Bilans et rapports</h1><StatsPanel scopeLabel={`Ensemble de ${s.org?.name ?? 'l’organisation'}`} /></>} />
            <Route path="sites" element={<><h1 style={{ fontSize: 28 }}>Sites, bâtiments et zones</h1><Places /></>} />
            <Route path="equipe" element={<Members />} />
            <Route path="reglages" element={<Settings />} />
            <Route path="*" element={<Navigate to="tableau" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Dashboard() {
  const s = useStore();
  const now = Date.now();
  const lastWeek = s.data.readings.filter(r => Date.parse(r.start) >= now - 7 * 864e5);
  const kWh = lastWeek.reduce((a, r) => a + r.kWh, 0);
  const upcoming = s.data.plans.filter(p => p.status === 'prevu' && Date.parse(p.end) > now).length;
  const measured = new Set(s.data.readings.map(r => r.deviceId)).size;
  return (
    <>
      <div className="between wrap"><div><span className="eyebrow">{fmt.day(now)}</span><h1 style={{ fontSize: 28 }}>Tableau de bord</h1></div></div>
      <div className="kpi-row">
        <div className="kpi-box"><span className="eyebrow">Consommation mesurée (7 j)</span><b className="num">{lastWeek.length ? fmt.kwh(kWh) : '—'}</b><span className="xs muted">{lastWeek.length ? `${lastWeek.length} relevés` : 'Aucune mesure : importez des relevés'}</span></div>
        <div className="kpi-box"><span className="eyebrow">Équipements</span><b className="num">{s.data.devices.length}</b><span className="xs muted">{measured} avec mesures · 0 connecté</span></div>
        <div className="kpi-box"><span className="eyebrow">Sites / bâtiments</span><b className="num">{s.data.sites.length} / {s.data.buildings.length}</b><span className="xs muted">{s.data.zones.length} zone(s)</span></div>
        <div className="kpi-box"><span className="eyebrow">Usages planifiés</span><b className="num">{upcoming}</b><span className="xs muted">à venir (rappels)</span></div>
      </div>
      <CarbonNow />
      <h2 style={{ fontSize: 22 }}>Recommandations du moment</h2>
      <RecoBoard />
    </>
  );
}

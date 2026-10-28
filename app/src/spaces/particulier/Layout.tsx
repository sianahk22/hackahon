import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useStore } from '../../data/store';
import { Banners } from '../../app/Shell';
import { Icon, Logo } from '../../ui/ui';
import './particulier.css';

const TABS = [
  { to: 'moments', label: 'Moments', icon: 'auto_awesome' },
  { to: 'planning', label: 'Planning', icon: 'calendar_today' },
  { to: 'appareils', label: 'Appareils', icon: 'devices' },
  { to: 'bilan', label: 'Bilan', icon: 'eco' },
];

export default function ParticulierLayout() {
  const s = useStore();
  const loc = useLocation();
  const current = TABS.find(t => loc.pathname.includes('/' + t.to))?.label ?? (loc.pathname.includes('reglages') ? 'Réglages' : 'Offre');
  return (
    <div className="space p-space">
      <header className="p-top">
        <div className="p-top-in">
          <Logo sub={current} />
          <Link to="/particulier/reglages" className="p-avatar" aria-label="Réglages du compte">{s.account?.displayName.slice(0, 1).toUpperCase()}</Link>
        </div>
      </header>
      <div className="p-banners"><Banners /></div>
      <main className="p-main"><Outlet /></main>
      <nav className="p-nav" aria-label="Navigation principale">
        <div className="p-nav-in">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}><Icon name={t.icon} /><span>{t.label}</span></NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Écran de connexion de démo : choix d'un profil, sans mot de passe.
import { Link, useNavigate } from 'react-router-dom';
import { PROFILES, useSession, type SpaceId } from '../../session/session';
import { DemoBadge, Icon, LegalFooter, Logo } from '../../ui/ui';

export default function Connexion() {
  const { login } = useSession();
  const nav = useNavigate();
  const go = (id: SpaceId) => { login(id); nav(PROFILES[id].path); };
  return (
    <div className="space">
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px', display: 'grid', gap: 24 }}>
        <Logo sub="Démo" />
        <h1>Choisissez un profil</h1>
        <DemoBadge>Connexion de démonstration, sans mot de passe</DemoBadge>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {(Object.keys(PROFILES) as SpaceId[]).map(id => (
            <button key={id} type="button" className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => go(id)}>
              <Icon name={PROFILES[id].icon} />
              <h2>{PROFILES[id].name}</h2>
              <p className="muted">{PROFILES[id].role}</p>
              <span className="pill sage">{PROFILES[id].offer}</span>
            </button>
          ))}
        </div>
        <Link to="/offres">Voir les offres</Link>
      </main>
      <LegalFooter />
    </div>
  );
}

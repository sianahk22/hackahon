// Connexion de DÉMO : on choisit un profil, sans mot de passe.
// Ce n'est PAS une sécurité : en production, il faudra une vraie authentification
// et un contrôle des droits côté serveur.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/ui';

export type SpaceId = 'habitant' | 'premium' | 'entreprise' | 'ville';

export const PROFILES: Record<SpaceId, { name: string; role: string; offer: string; path: string; icon: string }> = {
  habitant:   { name: 'Inès', role: 'Habitante, sans voiture électrique', offer: 'Gratuit', path: '/habitant', icon: 'home' },
  premium:    { name: 'Inès', role: 'Habitante, voiture électrique et borne', offer: 'Premium · 3,99 €/mois', path: '/premium', icon: 'ev_station' },
  entreprise: { name: 'Karim', role: 'Boulangerie du quartier', offer: 'Entreprise · sur devis', path: '/entreprise', icon: 'storefront' },
  ville:      { name: 'Sophie', role: 'Mairie de Montreuil (persona fictif)', offer: 'Ville · licence annuelle', path: '/ville', icon: 'location_city' },
};

const KEY = 'lbm-demo-profile';
function read(): SpaceId | null {
  try { const v = sessionStorage.getItem(KEY); return v && v in PROFILES ? (v as SpaceId) : null; } catch { return null; }
}

const Ctx = createContext<{ profile: SpaceId | null; login: (p: SpaceId) => void; logout: () => void }>({ profile: null, login: () => {}, logout: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<SpaceId | null>(read);
  const login = (p: SpaceId) => { setProfile(p); try { sessionStorage.setItem(KEY, p); } catch { /* stockage indisponible : la session reste en mémoire */ } };
  const logout = () => { setProfile(null); try { sessionStorage.removeItem(KEY); } catch { /* idem */ } };
  return <Ctx.Provider value={{ profile, login, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

// Chaque espace n'est visible qu'avec son profil : un habitant ne voit jamais l'espace Ville.
export function RequireProfile({ space, children }: { space: SpaceId; children: ReactNode }) {
  const { profile } = useSession();
  if (profile === space) return <>{children}</>;
  return (
    <main className="space" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center', display: 'grid', gap: 14 }}>
        <Icon name="lock" size={32} />
        <h1 style={{ fontSize: 26 }}>Espace réservé</h1>
        <p className="muted">Cet espace est réservé au profil « {PROFILES[space].offer} ». Connectez-vous avec ce profil pour y accéder.</p>
        <Link className="btn primary" to="/">Choisir un profil</Link>
      </div>
    </main>
  );
}

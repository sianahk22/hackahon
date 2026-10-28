// Éléments communs aux trois espaces : protection des routes et bandeaux d'information.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../data/store';
import type { ProfileKind } from '../core/types';
import { Icon } from '../ui/ui';
import { HOME } from './Onboarding';

export function RequireProfile({ kind, children }: { kind: ProfileKind; children: ReactNode }) {
  const s = useStore();
  if (!s.ready) return <div className="space" style={{ display: 'grid', placeItems: 'center' }} role="status">Chargement…</div>;
  if (!s.account || !s.account.profile) return <Navigate to="/" replace />;
  // Un compte n'accède qu'à l'espace de son profil.
  if (s.account.profile !== kind) return <Navigate to={HOME[s.account.profile]} replace />;
  return <>{children}</>;
}

export function Banners() {
  const s = useStore();
  return (
    <>
      {s.mode === 'local' && (
        <div className="banner local" role="note">
          <Icon name="lock_open" />
          <span><strong style={{ fontWeight: 600 }}>Mode local :</strong> données enregistrées dans ce navigateur, sans compte sécurisé. Ne saisissez pas de données sensibles.</span>
        </div>
      )}
      {s.hasDemo && (
        <div className="banner demo" role="note">
          <Icon name="science" />
          <span><strong style={{ fontWeight: 600 }}>Jeu de démonstration chargé :</strong> les équipements et relevés marqués « Démo » sont fictifs. Ils peuvent être supprimés dans les réglages.</span>
        </div>
      )}
    </>
  );
}

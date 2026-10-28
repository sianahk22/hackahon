import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { Icon } from '../ui/ui';

// Déconnexion visible dans chaque espace (en mode local, les données restent dans le navigateur).
export default function LogoutButton({ className = 'btn sm' }: { className?: string }) {
  const s = useStore();
  const nav = useNavigate();
  return <button type="button" className={className} onClick={async () => { await s.signOut(); nav('/'); }}><Icon name="logout" size={18} />Se déconnecter</button>;
}

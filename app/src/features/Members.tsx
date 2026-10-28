// Membres et rôles d'une organisation.
import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import type { Membership } from '../core/types';

const ROLES = { admin: 'Administrateur : tout, y compris les membres', gestionnaire: 'Gestionnaire : équipements, planification, pilotage autorisé', lecteur: 'Lecteur : consultation seule' };

export default function Members() {
  const s = useStore();
  const [list, setList] = useState<Membership[]>([]);
  useEffect(() => { s.listMembers().then(setList).catch(() => setList([])); }, [s.listMembers]);
  return (
    <section className="stack" style={{ gap: 14 }}>
      <h1 style={{ fontSize: 28 }}>Équipe et permissions</h1>
      <div className="card bordered stack">
        <h2 style={{ fontSize: 20 }}>Membres</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {list.map(m => <li key={m.accountId}>{m.accountId === s.account?.id ? `${s.account.displayName} (vous)` : m.accountId} — {m.role}</li>)}
        </ul>
        {s.mode === 'local'
          ? <p className="small muted">En mode local, une organisation n’a qu’un utilisateur. L’invitation de membres nécessite Supabase (comptes réels) ; les droits sont alors vérifiés par le serveur.</p>
          : <p className="small muted">Invitation de membres : à venir (nécessite une fonction serveur d’envoi d’invitation). Les rôles existants sont appliqués par les règles RLS.</p>}
      </div>
      <div className="card bordered stack">
        <h2 style={{ fontSize: 20 }}>Rôles</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{Object.entries(ROLES).map(([k, v]) => <li key={k}>{v}</li>)}</ul>
        <p className="xs muted">Les données d’une organisation ne sont jamais visibles par une autre. Les systèmes critiques sont exclus de toute automatisation, quel que soit le rôle.</p>
      </div>
    </section>
  );
}

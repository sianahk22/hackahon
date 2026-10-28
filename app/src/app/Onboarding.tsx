// Connexion puis choix du profil à la première connexion.
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../data/store';
import type { ProfileKind } from '../core/types';
import { Icon, Logo } from '../ui/ui';
import './onboarding.css';

export const HOME: Record<ProfileKind, string> = { particulier: '/particulier', entreprise: '/entreprise', collectivite: '/collectivite' };

export default function Entry() {
  const s = useStore();
  if (!s.ready) return <div className="space onb-center" role="status">Chargement…</div>;
  if (!s.account) return <Auth />;
  if (!s.account.profile) return <ProfileChoice />;
  return <Navigate to={HOME[s.account.profile]} replace />;
}

function Auth() {
  const s = useStore();
  const [mode, setMode] = useState<'creer' | 'connexion'>('creer');
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pwd, setPwd] = useState('');
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const local = s.mode === 'local';

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'creer') await s.signUp(email.trim(), pwd, name.trim());
      else await s.signIn(email.trim(), pwd);
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  };

  return (
    <main className="space onb">
      <div className="onb-col">
        <Logo sub="Bienvenue" />
        <h1 className="onb-title">Consommer au bon moment, pour le climat d’abord.</h1>
        <p className="muted">Le Bon Moment s’appuie sur l’intensité carbone réelle du réseau électrique français (RTE éCO2mix) pour vous indiquer quand utiliser vos appareils.</p>

        {local && (
          <div className="card soft small" role="note">
            <strong style={{ fontWeight: 500 }}>Mode local.</strong> Aucun serveur n’est configuré : votre compte et vos données restent dans ce navigateur, sans mot de passe ni protection.
            Pour de vrais comptes sécurisés, configurez Supabase (voir <code>docs/SUPABASE.md</code>).
          </div>
        )}

        <form className="card stack" onSubmit={submit}>
          {!local && (
            <div className="chips" role="tablist" aria-label="Type d’accès">
              <button type="button" role="tab" className="chip" aria-selected={mode === 'creer'} aria-pressed={mode === 'creer'} onClick={() => setMode('creer')}>Créer un compte</button>
              <button type="button" role="tab" className="chip" aria-selected={mode === 'connexion'} aria-pressed={mode === 'connexion'} onClick={() => setMode('connexion')}>Se connecter</button>
            </div>
          )}
          {mode === 'creer' && (
            <label className="field"><span>Nom affiché</span><input className="input" required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
          )}
          {!local && <>
            <label className="field"><span>Adresse e-mail</span><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
            <label className="field"><span>Mot de passe (8 caractères minimum)</span><input className="input" type="password" required minLength={8} value={pwd} onChange={e => setPwd(e.target.value)} autoComplete={mode === 'creer' ? 'new-password' : 'current-password'} /></label>
          </>}
          {err && <p className="small" role="alert" style={{ color: 'var(--danger)' }}>{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Patientez…' : local ? 'Créer un compte local' : mode === 'creer' ? 'Créer mon compte' : 'Me connecter'}</button>
        </form>
      </div>
    </main>
  );
}

const CHOICES: { kind: ProfileKind; title: string; text: string; icon: string }[] = [
  { kind: 'particulier', title: 'Particulier', text: 'Pour votre logement : recommandations, planning de vos appareils et bilan.', icon: 'home' },
  { kind: 'entreprise', title: 'Entreprise', text: 'Pour vos sites et bâtiments : inventaire des équipements, planification et rapports détaillés.', icon: 'domain' },
  { kind: 'collectivite', title: 'Collectivité', text: 'Pour une mairie ou un territoire : carte 3D réelle, bâtiments publics, équipements et bilans municipaux.', icon: 'account_balance' },
];

function ProfileChoice() {
  const s = useStore();
  const [kind, setKind] = useState<ProfileKind | null>(null);
  const [orgName, setOrgName] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!kind) return; setErr(''); setBusy(true);
    try { await s.chooseProfile(kind, kind === 'particulier' ? undefined : orgName.trim()); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
  };

  return (
    <main className="space onb">
      <form className="onb-col" onSubmit={submit}>
        <Logo sub="Premier pas" />
        <h1 className="onb-title">Bonjour {s.account!.displayName}. Qui êtes-vous ?</h1>
        <p className="muted">Ce choix détermine votre espace et ses fonctionnalités. Il pourra être modifié plus tard dans les réglages, tant qu’aucune donnée n’a été enregistrée.</p>
        <fieldset className="onb-choices">
          <legend className="sr-only">Type de compte</legend>
          {CHOICES.map(c => (
            <label key={c.kind} className={'onb-choice card' + (kind === c.kind ? ' on' : '')}>
              <input type="radio" name="kind" value={c.kind} checked={kind === c.kind} onChange={() => setKind(c.kind)} className="sr-only" />
              <Icon name={c.icon} size={26} />
              <span className="serif" style={{ fontSize: 22, color: 'var(--primary)' }}>{c.title}</span>
              <span className="small muted">{c.text}</span>
            </label>
          ))}
        </fieldset>
        {kind && kind !== 'particulier' && (
          <label className="field card">
            <span>{kind === 'entreprise' ? 'Nom de l’entreprise' : 'Nom de la collectivité'}</span>
            <input className="input" required minLength={2} maxLength={160} value={orgName} onChange={e => setOrgName(e.target.value)} />
            {kind === 'collectivite' && <span className="xs muted">L’espace municipal complet nécessite une activation administrative ou contractuelle. Votre organisation sera créée « en attente d’activation ».</span>}
          </label>
        )}
        {err && <p className="small" role="alert" style={{ color: 'var(--danger)' }}>{err}</p>}
        <button className="btn primary block" disabled={!kind || busy}>{busy ? 'Patientez…' : 'Continuer'}</button>
      </form>
    </main>
  );
}

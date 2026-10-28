// Réglages communs : contrat, offre, intégrations, démonstration, compte.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import type { TariffSettings } from '../core/types';
import { INTEGRATIONS } from '../core/integrations';
import { TEMPO_PRICES } from '../core/tariffs';
import { TEMPO_COLOR_SOURCE } from '../data/sources/public';
import { Icon, fmt } from '../ui/ui';

const num = (v: string) => (v.trim() === '' ? undefined : +v.replace(',', '.'));

export default function Settings() {
  const s = useStore();
  const nav = useNavigate();
  const [t, setT] = useState<TariffSettings>(s.settings.tariff);
  const [saved, setSaved] = useState(''), [confirmDemo, setConfirmDemo] = useState(false), [confirmProfile, setConfirmProfile] = useState(false);
  const hasData = s.data.devices.length + s.data.readings.length + s.data.plans.length > 0;
  const canWrite = s.role !== 'lecteur';

  const saveTariff = async (e: FormEvent) => {
    e.preventDefault();
    await s.saveSettings({ ...s.settings, tariff: t });
    await s.log('Modification du contrat d’électricité', 'ok');
    setSaved('Contrat enregistré.');
  };

  const todayColor = s.tempo.value?.[fmt.dayKey(Date.now())];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card stack">
        <h2>Compte</h2>
        <p className="small">{s.account?.displayName}{s.account?.email ? ` · ${s.account.email}` : ''} — profil <b style={{ fontWeight: 500 }}>{s.profile}</b>{s.org ? ` · ${s.org.name} (rôle : ${s.role})` : ''}</p>
        <p className="xs muted">{s.mode === 'local' ? 'Mode local : aucun serveur, données dans ce navigateur.' : 'Compte Supabase : données isolées par les règles du serveur.'}</p>
        <div className="row wrap">
          <button type="button" className="btn sm" onClick={async () => { await s.signOut(); nav('/'); }}><Icon name="logout" size={18} />Se déconnecter</button>
          {!hasData && !s.org && (confirmProfile
            ? <><span className="small">Changer de type de compte ?</span><button type="button" className="btn sm primary" onClick={async () => { await s.resetProfile(); nav('/'); }}>Confirmer</button><button type="button" className="btn sm ghost" onClick={() => setConfirmProfile(false)}>Annuler</button></>
            : <button type="button" className="btn sm ghost" onClick={() => setConfirmProfile(true)}>Changer de type de compte</button>)}
        </div>
        {hasData && <p className="xs muted">Le type de compte ne peut plus être changé ici car des données existent : contactez le support pour une migration encadrée.</p>}
      </section>

      <section className="card stack">
        <h2>Contrat d’électricité</h2>
        <p className="small muted">Sert uniquement à estimer les coûts. Le climat reste prioritaire dans les recommandations.</p>
        <form className="stack" onSubmit={saveTariff}>
          <label className="field"><span>Option tarifaire</span>
            <select value={t.kind} onChange={e => setT({ ...t, kind: e.target.value as TariffSettings['kind'] })} disabled={!canWrite}>
              <option value="inconnu">Je ne sais pas</option><option value="base">Base (prix unique)</option><option value="hphc">Heures pleines / heures creuses</option><option value="tempo">Tempo (EDF)</option>
            </select>
          </label>
          {t.kind === 'base' && <label className="field"><span>Prix du kWh TTC (€) — voir votre facture</span><input className="input" inputMode="decimal" value={t.base ?? ''} onChange={e => setT({ ...t, base: num(e.target.value) })} /></label>}
          {t.kind === 'hphc' && <div className="form-grid">
            <label className="field"><span>Heures pleines (€/kWh TTC)</span><input className="input" inputMode="decimal" value={t.hp ?? ''} onChange={e => setT({ ...t, hp: num(e.target.value) })} /></label>
            <label className="field"><span>Heures creuses (€/kWh TTC)</span><input className="input" inputMode="decimal" value={t.hc ?? ''} onChange={e => setT({ ...t, hc: num(e.target.value) })} /></label>
            <label className="field"><span>Début des heures creuses</span><select value={t.hcRanges?.[0]?.[0] ?? 22} onChange={e => setT({ ...t, hcRanges: [[+e.target.value, t.hcRanges?.[0]?.[1] ?? 6]] })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h</option>)}</select></label>
            <label className="field"><span>Fin des heures creuses</span><select value={t.hcRanges?.[0]?.[1] ?? 6} onChange={e => setT({ ...t, hcRanges: [[t.hcRanges?.[0]?.[0] ?? 22, +e.target.value]] })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h</option>)}</select></label>
          </div>}
          {t.kind === 'tempo' && <div className="small card soft stack" style={{ gap: 4 }}>
            <span>Prix réglementés TTC au 1er août 2026 : bleu {TEMPO_PRICES.BLEU.hc}/{TEMPO_PRICES.BLEU.hp} €, blanc {TEMPO_PRICES.BLANC.hc}/{TEMPO_PRICES.BLANC.hp} €, rouge {TEMPO_PRICES.ROUGE.hc}/{TEMPO_PRICES.ROUGE.hp} € (heures creuses / pleines).</span>
            <span>Couleur du jour : {todayColor ? <b style={{ fontWeight: 500 }}>{todayColor.toLowerCase()}</b> : 'indisponible'} · {TEMPO_COLOR_SOURCE}.</span>
          </div>}
          {canWrite && <button className="btn primary" style={{ justifySelf: 'start' }}>Enregistrer</button>}
          {saved && <p className="xs" role="status">{saved}</p>}
        </form>
      </section>

      {s.profile === 'particulier' && (
        <section className="card stack">
          <h2>Offre</h2>
          <div className="form-grid">
            <div className="card bordered stack" style={{ gap: 6 }}>
              <span className="pill sage" style={{ justifySelf: 'start' }}>Votre offre</span>
              <strong style={{ fontWeight: 500 }}>Gratuit</strong>
              <span className="small muted">Recommandations, planning, rappels et suivi avec vos appareils classiques.</span>
            </div>
            <div className="card bordered stack" style={{ gap: 6 }}>
              <span className="pill ghost" style={{ justifySelf: 'start' }}>Option · 3,99 €</span>
              <strong style={{ fontWeight: 500 }}>Connexion &amp; pilotage</strong>
              <span className="small muted">Connexion et pilotage des appareils compatibles. La compatibilité dépend de l’appareil, de son protocole et des intégrations disponibles.</span>
              <button type="button" className="btn sm" disabled aria-disabled="true">Souscription indisponible</button>
              <span className="xs muted">Aucun prestataire de paiement n’est configuré et la périodicité n’est pas encore fixée : aucun paiement ne peut être effectué.</span>
            </div>
          </div>
        </section>
      )}

      <section className="card stack">
        <h2>Sources et intégrations</h2>
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 10 }}>
          {INTEGRATIONS.map(i => (
            <li key={i.id} className="between wrap small" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ display: 'grid' }}><b style={{ fontWeight: 500 }}>{i.name}</b><span className="xs muted">{i.limits}</span></span>
              <span className={'pill ' + (i.status === 'operationnelle' ? 'sage' : 'ghost')}>{i.status === 'operationnelle' ? 'Opérationnelle' : i.status === 'non_configuree' ? 'Non configurée' : 'À développer'}</span>
            </li>
          ))}
        </ul>
        <p className="xs muted">Dernière mise à jour éCO2mix : {s.carbon.at ? fmt.date(s.carbon.at) : '—'} ({s.carbon.status}).</p>
      </section>

      <section className="card stack">
        <h2>Jeu de démonstration</h2>
        <p className="small muted">Données fictives pour présenter l’application. Elles sont marquées « Démo » partout et n’affectent pas vos données saisies.</p>
        {s.hasDemo ? (confirmDemo
          ? <div className="row wrap"><span className="small">Supprimer toutes les données de démonstration ?</span><button type="button" className="btn sm danger" onClick={async () => { await s.clearDemo(); setConfirmDemo(false); }}>Confirmer</button><button type="button" className="btn sm ghost" onClick={() => setConfirmDemo(false)}>Annuler</button></div>
          : <button type="button" className="btn sm danger" style={{ justifySelf: 'start' }} onClick={() => setConfirmDemo(true)} disabled={!canWrite}>Supprimer la démonstration</button>)
          : <button type="button" className="btn sm soft" style={{ justifySelf: 'start' }} onClick={s.loadDemo} disabled={!canWrite}>Charger le jeu de démonstration</button>}
      </section>

      {s.org && (
        <section className="card stack">
          <h2>Journal des actions</h2>
          {s.data.audit.length === 0 ? <p className="small muted">Aucune action enregistrée.</p> : (
            <ul className="small" style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflow: 'auto' }}>
              {s.data.audit.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50).map(a => <li key={a.id}>{fmt.date(a.at)} · {a.actor} · {a.action}{a.target ? ` (${a.target})` : ''} — {a.result}</li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

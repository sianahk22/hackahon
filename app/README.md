# Le Bon Moment — application

Application web qui transforme des données énergétiques réelles en recommandations : **consommer quand l'électricité est la moins carbonée, puis la moins chère**. Trois profils : **particulier**, **entreprise**, **collectivité**.

## Lancer le projet

```bash
cd ~/hackathon-bon-moment/app
npm install
npm run dev        # http://localhost:5173
npm test           # tests automatiques (Vitest)
npm run build      # vérification TypeScript + version de production dans dist/
```

Sans configuration, l'application tourne en **mode local** : le compte et les données restent dans le navigateur, sans sécurité. Un bandeau le signale en permanence.
Pour de vrais comptes : voir [docs/SUPABASE.md](docs/SUPABASE.md).

## Ce qui est réel, estimé, simulé ou absent

| Élément | Statut |
|---|---|
| Intensité carbone de l'électricité (France) | **Réelle** : RTE éCO2mix via ODRÉ, au pas de 15 min, sans clé |
| Intensité des heures à venir | **Estimation** : profil des 7 derniers jours recalé sur la dernière mesure ; « peu fiable » au-delà de 48 h |
| Prix Tempo | **Réels** (tarif réglementé TTC au 1er août 2026) |
| Couleur Tempo du jour | Source **tierce non officielle** (api-couleur-tempo.fr) ; l'API RTE officielle est à brancher côté serveur |
| Prix Base / Heures creuses | Saisis par l'utilisateur ; sinon le coût est « indisponible » |
| Carte 3D des collectivités | **Réelle** : OpenStreetMap (bâtiments en relief) via OpenFreeMap, contour officiel de la commune (geo.api.gouv.fr), adresses BAN |
| Consommation | **Uniquement les relevés importés** (CSV) ; aucune mesure = « indisponible », jamais zéro |
| Émissions | Estimation = kWh mesurés × intensité éCO2mix du même quart d'heure |
| Économies | « Prévisionnelles » (calculées à la planification) ; « constatées » non disponibles (méthode à construire) |
| Pilotage d'appareils | **Aucune intégration configurée** : rappels uniquement, aucune commande envoyée |
| Paiement de l'option à 3,99 € | **Non configuré** : aucune souscription possible |
| Jeu de démonstration | Fictif, désactivé par défaut, signalé « Démo » partout, supprimable |
| Simulateur (espace collectivité) | **Fictif** : ancien prototype de quartier simulé, présenté comme tel |

## Architecture

```
src/
  core/            logique pure, testée (aucune dépendance à l'interface)
    types.ts         modèle de données commun (comptes, organisations, sites, bâtiments, zones, équipements, relevés, plans, journal)
    datum.ts         statut d'une donnée : mesure / estimation / indisponible / obsolète / peu fiable
    carbon.ts        modèle d'intensité carbone (mesures + estimation)
    tariffs.ts       prix par quart d'heure (Base, HP/HC, Tempo), fuseau de Paris
    recommend.ts     moteur : CO₂ d'abord, puis coût, échéance toujours respectée
    stats.ts         agrégations par équipement / catégorie / bâtiment / zone / site / période, anomalies
    csv.ts           import / export des relevés
    permissions.ts   rôles et garde-fous du pilotage
    integrations.ts  registre documenté des intégrations
  data/
    sources/public.ts  appels aux API publiques réelles
    repo/              stockage : local (navigateur) ou Supabase (RLS)
    store.tsx          magasin central (compte, organisation, données, sources)
    demo.ts            jeu de démonstration étiqueté
  features/        composants métier partagés (fiches, inventaire, statistiques, recommandations, réglages)
  spaces/
    particulier/     Moments · Planning · Appareils · Bilan (maquettes Stitch)
    entreprise/      tableau de bord, planification, inventaire, bilans, sites, équipe
    collectivite/    Moments · Villes 3D · Appareils · Bilan (+ quartiers, équipe, réglages)
    ville/           Simulateur fictif (ancien prototype, React Three Fiber)
  engine/          moteur du simulateur (non-régression avec reference/app-base.html)
supabase/migrations/0001_init.sql   schéma + règles d'isolation RLS
reference/                           prototype d'origine et maquettes Stitch (non modifiés)
```

## Sécurité

- **Isolation** : chaque donnée a un propriétaire (utilisateur ou organisation). En mode Supabase, les règles RLS empêchent tout accès hors périmètre, y compris entre deux mairies.
- **Rôles** : administrateur, gestionnaire, lecteur. Un lecteur ne peut rien modifier.
- **Collectivités** : l'espace municipal exige une activation qu'aucun utilisateur ne peut s'attribuer (pas de règle d'écriture). En mode local, une activation « de test » est possible et signalée.
- **Pilotage** : une commande exige rôle, appareil compatible, autorisation, connexion et intégration réelle. Les systèmes critiques (groupes électrogènes, sécurité) sont toujours exclus.
- **Secrets** : aucune clé dans le code. Seules `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (publique par conception) vont dans `.env.local`, qui n'est pas versionné.

## Limites connues

- Mode Supabase écrit mais **non testé contre un vrai projet** (aucun projet configuré).
- Invitation de membres, export PDF, économies constatées, coûts par site : non implémentés.
- Intensité carbone **nationale** (pas locale) ; pas de prévision officielle publiée par RTE.
- Le planificateur de quartier du Simulateur reste l'algorithme glouton du prototype.

## Tests

`npm test` : 136 tests, dont 108 de non-régression du simulateur (chiffres identiques à `reference/app-base.html`), et des tests sur le moteur de recommandation, les tarifs, le changement d'heure, l'import CSV, les statistiques, l'isolation des données et les garde-fous du pilotage.

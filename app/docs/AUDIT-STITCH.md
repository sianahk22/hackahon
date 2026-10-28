# Audit des maquettes Stitch

Source : `~/Downloads/stitch_le_bon_moment_app(1).zip`, extrait sans modification dans `reference/stitch/ecrans/`.

## Écrans examinés

| Dossier | Contenu | Usage |
|---|---|---|
| `serene_ecological_timing/DESIGN.md` | Système de design | Tokens |
| `moments_tableau_de_bord` | Accueil, recommandation, alternatives, vue du foyer | Particulier · Moments |
| `appareils_pilotage` | Liste d'équipements, filtres, statut de pilotage | Particulier · Appareils |
| `planning_intelligent` | Modes Conseils / Planning, jours, rythme 24 h, ligne du temps | Particulier · Planning |
| `bilan_progression` | Périodes, CO₂, économies, détail par usage | Particulier · Bilan |
| `collectivit_territoire_3d` | Collectivité (format mobile, 3D décorative) | Inspiration seulement |
| `three.js` | Scène 3D de cubes (formes arbitraires) | Non reprise : pas une géographie réelle |

## Divergences relevées

| Élément | DESIGN.md | Code HTML (toutes les captures) | Retenu |
|---|---|---|---|
| Vert principal | `#1B382B` | `primary: #042217` (`#1B382B` = `primary-container`) | **#042217** (rendu validé des captures) |
| Sauge | `#5C7F67` | `secondary: #44664F` | **#44664F** |
| Rayons | 8 / 16 / 24 px | Tailwind : `DEFAULT 4px`, `lg 8px`, `xl 12px` (cartes en `rounded-xl` = 12 px) | **12 px** pour les cartes |
| Fond | `#FAF8F5` et `#F2FCF5` | `bg-surface-canvas` = `#FAF8F5` | **#FAF8F5** |

## Éléments volontairement non repris

- Les **chiffres** des maquettes (« 92 % décarboné », « 14,8 kg de CO₂ évités », « 18,40 € », « 100 % vert garanti ») : remplacés par des valeurs calculées ou par « indisponible ».
- Les **marques** (Daikin, Bosch, Atlantic, De Dietrich, Wallbox) : non affichées par défaut ; l'utilisateur saisit le fabricant.
- Les **photos** hébergées chez Google : remplacées par des icônes et un dégradé.
- Les **paliers / récompenses** et le « rapport certifié » du Bilan : aucune base réelle pour les fonder ; non implémentés.
- La mention « Données certifiées RTE & Eco2Mix » : remplacée par une provenance exacte (éCO2mix, estimation, méthode).

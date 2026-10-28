# ☀️ Le Bon Moment

> **Le pilote automatique de l'énergie du quartier.**
> Tu dis *pour quand*, l'app décide *quand* et *où*.

Projet réalisé pendant le **Hackathon HETIC 2026**.

---

## Le problème

- **Le soleil est gaspillé.** Dans les opérations d'autoconsommation collective (panneaux partagés entre voisins), la production arrive à midi, quand les habitants sont absents.
- **Le réseau sature le soir.** Tout le monde rentre et lance ses appareils en même temps : voiture, lave-linge, chauffe-eau à 22 h.
- **Les prix changent.** Avec Tempo, un kWh coûte jusqu'à **0,73 €** en jour rouge, contre **0,14 €** en heures creuses d'un jour bleu (tarifs EDF au 1er août 2026).

Les applications actuelles donnent des **conseils** ou des **alertes**. Personne ne **coordonne** les voisins entre eux.

## Notre solution

L'habitant indique seulement ses besoins et leur échéance :

> « Ma voiture chargée **avant 7 h** » · « Le linge lavé **avant ce soir** »

L'application calcule le meilleur moment pour chaque appareil, en tenant compte :

| Critère | Source |
|---|---|
| 💶 Le prix de l'électricité | Tarifs Tempo (heures pleines / creuses, couleur du jour) |
| 🌍 Le CO₂ du kWh | Données éCO2mix (RTE) |
| ☀️ Le soleil produit dans le quartier | Prévisions météo + production des panneaux |
| ⚡ La capacité du réseau local | Limite du poste électrique |

Puis elle **coordonne tout le quartier** : les tâches sont étalées pour consommer le soleil et ne jamais saturer le poste. **L'échéance passe toujours avant l'économie.**

## Trois niveaux

| Niveau | Pour qui | Ce que ça apporte |
|---|---|---|
| 🏠 **Maison** | Habitants, commerces | Pilotage automatique ou rappels, économies sur la facture |
| 🏘️ **Quartier** | Mairies, bailleurs, coopératives | Plus de soleil consommé sur place, pic du soir réduit |
| 🏙️ **Ville** | Collectivités | Bâtiments municipaux, bornes de recharge publiques, tableau de bord |

## Le prototype

Un prototype web interactif avec 4 interfaces :

- **Quartier 3D** : le quartier en temps réel, le flux du soleil et du réseau, la comparaison avec et sans coordination.
- **Mon foyer** : les besoins d'un habitant (ou d'un commerce) et le planning calculé.
- **Mairie** : les indicateurs de l'opération et un simulateur (« et si l'école participait ? »).
- **Offres** : le modèle économique.

> ⚠️ Le moteur de planification fonctionne réellement, mais **le quartier, la météo et le CO₂ sont simulés**. Seuls les prix Tempo sont réels.

## Technique

| Brique | Prototype | Version cible |
|---|---|---|
| Interface | HTML / CSS / JavaScript | React |
| 3D | Three.js | React Three Fiber |
| Prévisions (soleil, CO₂) | Courbes simulées | Modèles d'apprentissage (gradient boosting / LSTM) sur éCO2mix et Open-Meteo |
| Planification | Algorithme glouton | Optimisation sous contraintes (OR-Tools) |
| API | — | FastAPI |
| Appareils | — | API constructeurs, Matter |

## Modèle économique

- **Gratuit** pour les habitants
- **Premium** pour les foyers équipés (voiture électrique, pilotage automatique)
- **Quartier** : abonnement pour les mairies, bailleurs et coopératives d'autoconsommation
- **Ville** : offre pour les collectivités

*Les prix sont des hypothèses de travail.*

## L'équipe

- Anaïs
- Lily
- Joseph
- Dorian

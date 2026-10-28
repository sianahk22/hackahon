# Intégrations

Registre dans le code : `src/core/integrations.ts` (affiché dans Réglages → Sources et intégrations).

| Intégration | Statut | Prérequis |
|---|---|---|
| RTE éCO2mix (intensité carbone) | Opérationnelle, testée le 28/10/2026 | Aucun (données ouvertes ODRÉ) |
| Couleur Tempo | Opérationnelle via une source tierce non officielle | Pour l'officielle : compte data.rte-france.com, API « Tempo Like Supply Contract », secret OAuth dans une fonction serveur |
| geo.api.gouv.fr / Base Adresse Nationale | Opérationnelles | Aucun |
| OpenFreeMap (carte, OpenStreetMap) | Opérationnelle | Attribution obligatoire (affichée) |
| Compteur Linky (Enedis Data Connect) | Non configurée | Contrat Enedis, consentement du client, serveur OAuth. En attendant : import CSV |
| Matter / prises connectées | À développer | Passerelle locale + connecteur serveur |
| API constructeurs | À développer | Accord avec chaque fabricant, secrets côté serveur |
| GTB (BACnet, Modbus, KNX) | À développer | Passerelle sur site, étude de cybersécurité, accord de l'exploitant |

Règle : tant qu'aucune intégration de commande n'est opérationnelle (`COMMAND_INTEGRATION_READY = false`), l'application n'envoie **aucune commande** ; elle crée des rappels.

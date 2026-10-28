// Registre des adaptateurs d'intégration (architecture hybride).
// Statut honnête : AUCUNE intégration d'appareil n'est configurée dans cette version.
// Les secrets (OAuth, clés) devront vivre côté serveur (fonction Supabase), jamais dans le navigateur.

export interface Integration {
  id: string;
  name: string;
  status: 'operationnelle' | 'non_configuree' | 'a_developper';
  devices: string;
  data: string;
  frequency: string;
  commands: string;
  authorization: string;
  limits: string;
  prerequisite: string;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'eco2mix', name: 'RTE éCO2mix (intensité carbone)', status: 'operationnelle',
    devices: 'Aucun (donnée nationale)', data: 'Intensité carbone de l’électricité en France (g CO₂/kWh)', frequency: '15 min, publication en quasi temps réel',
    commands: 'Aucune', authorization: 'Aucune (données ouvertes, plateforme ODRÉ)', limits: 'Moyenne nationale, pas locale. Pas de prévision publiée : les heures futures sont estimées.', prerequisite: 'Connexion internet',
  },
  {
    id: 'tempo', name: 'Couleur Tempo', status: 'operationnelle',
    devices: 'Aucun', data: 'Couleur du jour et du lendemain', frequency: 'Quotidienne (lendemain publié vers 10h30)',
    commands: 'Aucune', authorization: 'Aucune', limits: 'Source tierce non officielle (api-couleur-tempo.fr). La source officielle RTE exige un compte et un secret OAuth côté serveur.', prerequisite: 'Pour l’API officielle : compte data.rte-france.com, abonnement « Tempo Like Supply Contract », fonction serveur.',
  },
  {
    id: 'enedis', name: 'Compteur Linky (Enedis Data Connect)', status: 'non_configuree',
    devices: 'Compteurs Linky', data: 'Consommation quotidienne et courbe de charge (30 min)', frequency: 'J+1 (pas de temps réel)',
    commands: 'Aucune (lecture seule)', authorization: 'Consentement explicite du titulaire du contrat, renouvelable', limits: 'Accès réservé aux partenaires habilités ; données disponibles le lendemain.', prerequisite: 'Contrat Enedis Data Connect, serveur pour l’échange OAuth. En attendant : import CSV depuis l’espace client Enedis.',
  },
  {
    id: 'matter', name: 'Matter / prises connectées', status: 'a_developper',
    devices: 'Prises et appareils certifiés Matter', data: 'État, parfois puissance instantanée', frequency: 'Temps réel (réseau local)',
    commands: 'Marche / arrêt selon l’appareil', authorization: 'Appairage local par l’utilisateur', limits: 'Nécessite une passerelle sur le réseau local ; un navigateur seul ne peut pas piloter Matter.', prerequisite: 'Passerelle locale (ex. contrôleur domotique) + connecteur serveur.',
  },
  {
    id: 'constructeurs', name: 'API constructeurs (électroménager, bornes, pompes à chaleur)', status: 'a_developper',
    devices: 'Selon les fabricants ayant une API ouverte', data: 'État, programmes, parfois consommation', frequency: 'Variable',
    commands: 'Départ différé, consigne, recharge selon le fabricant', authorization: 'Compte fabricant de l’utilisateur + accord OAuth', limits: 'Chaque fabricant est différent ; beaucoup d’API sont fermées ou réservées à des partenaires.', prerequisite: 'Accord partenaire avec chaque fabricant, secrets côté serveur.',
  },
  {
    id: 'gtb', name: 'Gestion technique du bâtiment (BACnet, Modbus, KNX)', status: 'a_developper',
    devices: 'CVC, éclairage, compteurs divisionnaires des bâtiments tertiaires et publics', data: 'Mesures et états des équipements', frequency: 'De la seconde au quart d’heure',
    commands: 'Consignes et plages horaires, selon droits', authorization: 'Accord du gestionnaire du bâtiment, compte de service dédié', limits: 'Accès réseau sur site, protocoles hétérogènes, enjeux de cybersécurité.', prerequisite: 'Passerelle sur site, étude de sécurité, validation par l’exploitant.',
  },
];

// Aucune intégration capable d'envoyer des commandes n'est opérationnelle.
export const COMMAND_INTEGRATION_READY = false;

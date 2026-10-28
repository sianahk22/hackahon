// Règles de permissions et garde-fous du pilotage.
// Côté navigateur, ces règles servent à l'affichage ; la vraie protection est côté serveur
// (règles RLS Supabase, voir supabase/migrations). Une commande n'est JAMAIS envoyée sans intégration réelle.
import type { Device, Role } from './types';

export type Action = 'lire' | 'modifier' | 'planifier' | 'piloter' | 'gerer_membres';

const MATRIX: Record<Role, Action[]> = {
  admin: ['lire', 'modifier', 'planifier', 'piloter', 'gerer_membres'],
  gestionnaire: ['lire', 'modifier', 'planifier', 'piloter'],
  lecteur: ['lire'],
};
export const can = (role: Role, a: Action) => MATRIX[role].includes(a);

export interface CommandCheck { allowed: boolean; reasons: string[] }

// Toutes les conditions doivent être réunies pour envoyer une commande à un appareil.
export function checkCommand(d: Device, role: Role, integrationReady: boolean): CommandCheck {
  const reasons: string[] = [];
  if (!can(role, 'piloter')) reasons.push('Votre rôle ne permet pas de piloter des équipements.');
  if (d.critical) reasons.push('Système critique (secours, sécurité) : pilotage automatique exclu sans validation technique et analyse des risques.');
  if (!d.control.compatible) reasons.push('Appareil non déclaré compatible avec le pilotage.');
  if (!d.control.authorized) reasons.push('Pilotage non autorisé pour cet appareil.');
  if (d.connection.status !== 'connecte') reasons.push('Appareil non connecté.');
  if (!integrationReady) reasons.push('Aucune intégration constructeur configurée : aucune commande ne peut être envoyée.');
  return { allowed: reasons.length === 0, reasons };
}

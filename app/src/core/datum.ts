// Une donnée affichée porte toujours son statut et sa provenance.
export type DataStatus = 'mesure' | 'estimation' | 'indisponible' | 'obsolete' | 'peu_fiable';

export interface Datum<T = number> {
  status: DataStatus;
  value?: T;
  unit?: string;
  source?: string;   // d'où vient la donnée
  at?: string;       // horodatage ISO de la donnée
  method?: string;   // pour une estimation : comment elle est calculée
  reason?: string;   // pour une donnée absente : pourquoi
  howTo?: string;    // pour une donnée absente : comment l'obtenir
}

export const missing = (reason: string, howTo?: string): Datum<never> => ({ status: 'indisponible', reason, howTo });
export const hasValue = <T>(d: Datum<T> | undefined): d is Datum<T> & { value: T } =>
  !!d && d.value !== undefined && d.status !== 'indisponible';

export const STATUS_LABEL: Record<DataStatus, string> = {
  mesure: 'Mesure réelle',
  estimation: 'Estimation',
  indisponible: 'Indisponible',
  obsolete: 'Donnée obsolète',
  peu_fiable: 'Estimation peu fiable',
};

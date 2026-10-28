// Intensité carbone réelle sur la période couverte par des relevés (pour estimer leurs émissions).
import { useEffect, useMemo, useState } from 'react';
import { CarbonModel } from '../core/carbon';
import type { Reading } from '../core/types';
import { fetchCarbonRange } from '../data/sources/public';

const cache = new Map<string, CarbonModel>();

export function useCarbonForReadings(readings: Reading[]) {
  const span = useMemo(() => {
    if (!readings.length) return null;
    let a = Infinity, b = -Infinity;
    for (const r of readings) { a = Math.min(a, Date.parse(r.start)); b = Math.max(b, Date.parse(r.end)); }
    // Arrondi au jour pour mutualiser les appels.
    return { from: Math.floor(a / 864e5) * 864e5, to: Math.ceil(b / 864e5) * 864e5 };
  }, [readings]);
  const key = span ? `${span.from}-${span.to}` : '';
  const [state, setState] = useState<{ status: 'vide' | 'chargement' | 'ok' | 'erreur'; model?: CarbonModel; error?: string }>({ status: 'vide' });

  useEffect(() => {
    if (!span) { setState({ status: 'vide' }); return; }
    if (cache.has(key)) { setState({ status: 'ok', model: cache.get(key) }); return; }
    let alive = true;
    setState({ status: 'chargement' });
    fetchCarbonRange(new Date(span.from), new Date(span.to))
      .then(pts => { const m = new CarbonModel(pts); cache.set(key, m); if (alive) setState({ status: 'ok', model: m }); })
      .catch(e => alive && setState({ status: 'erreur', error: e instanceof Error ? e.message : String(e) }));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

// Économies PRÉVISIONNELLES : écarts calculés au moment de la planification (jamais « constatées »).
export function forecastSavings(plans: { status: string; co2g?: number; refCo2g?: number; costEur?: number; refCostEur?: number }[]) {
  const kept = plans.filter(p => p.status !== 'annule');
  const withCo2 = kept.filter(p => p.co2g !== undefined && p.refCo2g !== undefined);
  const withCost = kept.filter(p => p.costEur !== undefined && p.refCostEur !== undefined);
  return {
    n: kept.length,
    co2g: withCo2.length ? withCo2.reduce((s, p) => s + (p.refCo2g! - p.co2g!), 0) : undefined,
    eur: withCost.length ? withCost.reduce((s, p) => s + (p.refCostEur! - p.costEur!), 0) : undefined,
    nCo2: withCo2.length, nCost: withCost.length,
  };
}

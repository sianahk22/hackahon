import { describe, it, expect } from 'vitest';
import { LocalBackend, MemoryStorage } from '../../data/repo/local';
import { parseReadingsCsv } from '../csv';
import { aggregate, anomalies, total, periodKey } from '../stats';
import { checkCommand } from '../permissions';
import { CarbonModel } from '../carbon';
import type { Device, Reading } from '../types';

const device = (over: Partial<Device> = {}): Device => ({
  id: 'd1', ownerId: 'A', name: 'Pompe', categoryId: 'c-pompes', interruptible: false, essential: false, critical: false,
  constraints: {}, connection: { status: 'connecte' }, control: { compatible: true, authorized: true, automation: false },
  origin: 'saisie', createdAt: '', ...over,
});

describe('isolation des données (mode local)', () => {
  it('un propriétaire ne voit jamais les données d’un autre', async () => {
    const b = new LocalBackend(new MemoryStorage());
    await b.put('devices', device({ id: 'a1', ownerId: 'mairie-A' }));
    await b.put('devices', device({ id: 'b1', ownerId: 'mairie-B' }));
    expect((await b.list('mairie-A', 'devices')).map(d => d.id)).toEqual(['a1']);
    expect((await b.list('mairie-B', 'devices')).map(d => d.id)).toEqual(['b1']);
    await b.remove('mairie-A', 'devices', 'b1'); // tentative hors périmètre : sans effet
    expect(await b.list('mairie-B', 'devices')).toHaveLength(1);
  });
  it('supprime la démo sans toucher aux données saisies', async () => {
    const b = new LocalBackend(new MemoryStorage());
    await b.putMany('devices', [device({ id: 'x', origin: 'demo' }), device({ id: 'y', origin: 'saisie' })]);
    await b.removeWhere('A', 'devices', { origin: 'demo' });
    expect((await b.list('A', 'devices')).map(d => d.id)).toEqual(['y']);
  });
});

describe('import CSV', () => {
  it('lit le format debut;fin;kwh avec virgule décimale et heure de Paris', () => {
    const r = parseReadingsCsv('debut;fin;kwh\n2026-10-01 00:00;2026-10-01 01:00;0,42\n');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toEqual({ start: '2026-09-30T22:00:00.000Z', end: '2026-09-30T23:00:00.000Z', kWh: .42 }); // UTC+2 en octobre avant le 25
  });
  it('signale les lignes invalides au lieu de les compter comme zéro', () => {
    const r = parseReadingsCsv('date;kwh\n2026-10-01 00:00;abc\npas une date;1\n');
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(2);
  });
  it('refuse un en-tête inconnu', () => {
    expect(parseReadingsCsv('a;b\n1;2').errors[0]).toMatch(/En-tête/);
  });
});

describe('statistiques', () => {
  const L = { devices: [device(), device({ id: 'd2', name: 'Éclairage', categoryId: 'c-eclairage' })], categories: [], buildings: [], zones: [], sites: [] };
  const rd = (deviceId: string, start: string, kWh: number): Reading => ({ id: start + deviceId, ownerId: 'A', deviceId, start, end: new Date(new Date(start).getTime() + 3600e3).toISOString(), kWh, source: 'import_csv', importedAt: '' });

  it('total indisponible sans mesure (jamais zéro)', () => {
    expect(total([]).status).toBe('indisponible');
  });
  it('agrège par équipement et calcule le CO₂ seulement là où l’intensité est mesurée', () => {
    const t0 = '2026-10-10T10:00:00.000Z';
    const carbon = new CarbonModel([{ t: Date.parse(t0), g: 50 }, { t: Date.parse(t0) + 15 * 60e3, g: 50 }, { t: Date.parse(t0) + 30 * 60e3, g: 50 }, { t: Date.parse(t0) + 45 * 60e3, g: 50 }]);
    const rows = aggregate([rd('d1', t0, 10), rd('d2', '2026-01-01T10:00:00.000Z', 5)], 'equipement', L, carbon);
    expect(rows[0]).toMatchObject({ label: 'Pompe', kWh: 10, co2kg: .5, co2Coverage: 1 });
    expect(rows[1].co2kg).toBeUndefined(); // pas d'intensité connue pour cette date
  });
  it('détecte un jour anormal (> moyenne + 3 écarts-types sur 14 jours au moins)', () => {
    const rs: Reading[] = [];
    for (let k = 0; k < 20; k++) rs.push(rd('d1', `2026-10-${String(k + 1).padStart(2, '0')}T10:00:00.000Z`, k === 15 ? 50 : 10 + (k % 3)));
    const a = anomalies(rs, L);
    expect(a).toHaveLength(1);
    expect(a[0].day).toBe('2026-10-16');
  });
  it('regroupe par semaine ISO', () => {
    expect(periodKey('2026-10-28T10:00:00Z', 'semaine')).toBe('2026-S44');
  });
});

describe('garde-fous du pilotage', () => {
  it('refuse toute commande sans intégration réelle', () => {
    expect(checkCommand(device(), 'admin', false).allowed).toBe(false);
  });
  it('refuse le pilotage d’un système critique, même autorisé', () => {
    const c = checkCommand(device({ critical: true }), 'admin', true);
    expect(c.allowed).toBe(false);
    expect(c.reasons.join()).toMatch(/critique/);
  });
  it('refuse le pilotage à un lecteur', () => {
    expect(checkCommand(device(), 'lecteur', true).allowed).toBe(false);
  });
  it('autorise seulement quand toutes les conditions sont réunies', () => {
    expect(checkCommand(device(), 'gestionnaire', true).allowed).toBe(true);
  });
});

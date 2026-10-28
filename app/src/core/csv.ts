// Import et export CSV des relevés de consommation.
// Format accepté (séparateur ; ou ,) avec en-tête :
//   debut;fin;kwh          ex. 2026-10-01T00:00;2026-10-01T01:00;0,42
//   ou date;kwh            (période d'une heure à partir de « date »)
// Les dates sans fuseau sont lues comme heure de Paris.

export interface ParsedReading { start: string; end: string; kWh: number }
export interface ParseResult { rows: ParsedReading[]; errors: string[] }

const num = (s: string) => Number(s.trim().replace(/\s/g, '').replace(',', '.'));

function parisToIso(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(v)) { const d = new Date(v); return isNaN(+d) ? null : d.toISOString(); }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/) ?? v.match(/^(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
  // Décalage réel de Paris à cette date (heure d'été / d'hiver).
  const guess = Date.UTC(+y, +mo - 1, +d, +m[4], +m[5]);
  const off = parisOffsetMin(guess);
  return new Date(guess - off * 60e3).toISOString();
}

function parisOffsetMin(utc: number) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' });
  const tz = f.formatToParts(new Date(utc)).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = tz.match(/GMT([+-]\d+)/);
  return m ? +m[1] * 60 : 60;
}

export function parseReadingsCsv(text: string): ParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const errors: string[] = [], rows: ParsedReading[] = [];
  if (!lines.length) return { rows, errors: ['Fichier vide.'] };
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].toLowerCase().split(sep).map(s => s.trim());
  const iStart = head.findIndex(h => ['debut', 'début', 'date', 'start'].includes(h));
  const iEnd = head.findIndex(h => ['fin', 'end'].includes(h));
  const iKwh = head.findIndex(h => ['kwh', 'valeur_kwh', 'consommation_kwh'].includes(h));
  if (iStart < 0 || iKwh < 0) return { rows, errors: ['En-tête attendu : « debut;fin;kwh » ou « date;kwh ».'] };
  lines.slice(1).forEach((l, k) => {
    const c = l.split(sep);
    const start = parisToIso(c[iStart] ?? '');
    const end = iEnd >= 0 ? parisToIso(c[iEnd] ?? '') : start && new Date(new Date(start).getTime() + 3600e3).toISOString();
    const kWh = num(c[iKwh] ?? '');
    if (!start || !end) errors.push(`Ligne ${k + 2} : date illisible.`);
    else if (!isFinite(kWh) || kWh < 0) errors.push(`Ligne ${k + 2} : valeur kWh invalide.`);
    else if (new Date(end) <= new Date(start)) errors.push(`Ligne ${k + 2} : la fin précède le début.`);
    else rows.push({ start, end, kWh });
  });
  return { rows, errors };
}

export function toCsv(rows: Record<string, string | number | undefined>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
}

export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

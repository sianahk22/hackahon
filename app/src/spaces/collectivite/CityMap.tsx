// Carte 3D d'un territoire RÉEL : MapLibre + tuiles OpenFreeMap (données OpenStreetMap, ODbL).
// Les bâtiments en relief viennent d'OpenStreetMap ; le contour de la commune de geo.api.gouv.fr.
// Les bâtiments et équipements municipaux sont ceux enregistrés par la collectivité.
import { useEffect, useRef, useState } from 'react';
import { Map as MlMap, NavigationControl, ScaleControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre 6 charge son décodeur de tuiles dans un « worker » séparé (fichier autonome) : Vite le sert tel quel et fournit son adresse.
setWorkerUrl(workerUrl);
import type { Building, Device, Territory } from '../../core/types';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export type Selection =
  | { kind: 'ville' } | { kind: 'zone'; id: string } | { kind: 'batiment'; id: string }
  | { kind: 'categorie'; id: string } | { kind: 'equipement'; id: string };

interface Props {
  territory: Territory;
  buildings: Building[];
  devices: (Device & { color: string })[];
  showBuildings: boolean;
  showDevices: boolean;
  selection: Selection;
  placing: boolean;
  onSelect: (s: Selection) => void;
  onMapClick: (lon: number, lat: number) => void;
}

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

export default function CityMap(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const cb = useRef(p); cb.current = p;

  // Création de la carte (une seule fois par territoire).
  useEffect(() => {
    if (!box.current) return;
    let m: MlMap;
    try {
      m = new MlMap({ container: box.current, style: STYLE_URL, center: p.territory.centre, zoom: 14.2, pitch: 55, bearing: -18, maxPitch: 70, attributionControl: { compact: false } });
    } catch (e) { setError('Affichage 3D impossible : WebGL indisponible dans ce navigateur.'); return; }
    map.current = m;
    m.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('error', e => { if (!m.loaded()) setError(`Carte indisponible : ${e.error?.message ?? 'erreur réseau'}`); });
    m.on('load', () => {
      if (map.current !== m) return; // carte remplacée entre-temps (double montage en développement)
      if (p.territory.contour) {
        m.addSource('territoire', { type: 'geojson', data: { type: 'Feature', geometry: p.territory.contour, properties: {} } });
        m.addLayer({ id: 'territoire-fill', type: 'fill', source: 'territoire', paint: { 'fill-color': '#0B3142', 'fill-opacity': .04 } });
        m.addLayer({ id: 'territoire-line', type: 'line', source: 'territoire', paint: { 'line-color': '#0B3142', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      }
      m.addSource('batiments', { type: 'geojson', data: fc([]) });
      m.addSource('equipements', { type: 'geojson', data: fc([]) });
      m.addLayer({ id: 'batiments-halo', type: 'circle', source: 'batiments', paint: { 'circle-radius': ['case', ['get', 'sel'], 22, 14], 'circle-color': '#0E7C86', 'circle-opacity': ['case', ['get', 'sel'], .35, .18] } });
      m.addLayer({ id: 'batiments', type: 'circle', source: 'batiments', paint: { 'circle-radius': 7, 'circle-color': '#0B3142', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      m.addLayer({ id: 'batiments-label', type: 'symbol', source: 'batiments', layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#0B3142', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
      m.addLayer({ id: 'equipements', type: 'circle', source: 'equipements', paint: { 'circle-radius': ['case', ['get', 'sel'], 8, 5], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      for (const id of ['batiments', 'equipements']) {
        m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
      }
      setReady(true);
    });
    m.on('click', (e: MapMouseEvent) => {
      const c = cb.current;
      if (!c.placing) {
        const hit = m.queryRenderedFeatures(e.point, { layers: ['equipements', 'batiments'].filter(l => m.getLayer(l)) })[0];
        if (hit) { c.onSelect(hit.layer.id === 'equipements' ? { kind: 'equipement', id: String(hit.properties.id) } : { kind: 'batiment', id: String(hit.properties.id) }); return; }
      }
      c.onMapClick(e.lngLat.lng, e.lngLat.lat);
    });
    return () => { m.remove(); map.current = null; setReady(false); };
  }, [p.territory.codeInsee]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour des couches.
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    const srcB = m.getSource('batiments') as GeoJSONSource | undefined, srcD = m.getSource('equipements') as GeoJSONSource | undefined;
    if (!srcB || !srcD) return;
    const sel = p.selection;
    const located = p.buildings.filter(b => b.lon !== undefined && b.lat !== undefined);
    srcB.setData(fc(p.showBuildings ? located.map(b => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [b.lon!, b.lat!] }, properties: { id: b.id, name: b.name, sel: sel.kind === 'batiment' && sel.id === b.id },
    })) : []));
    // Équipements : leurs coordonnées, sinon celles de leur bâtiment (légèrement décalées pour rester visibles).
    const perBuilding = new Map<string, number>();
    const pts: GeoJSON.Feature[] = [];
    for (const d of p.devices) {
      let lon = d.lon, lat = d.lat;
      if (lon === undefined) {
        const b = located.find(x => x.id === d.buildingId); if (!b) continue;
        const k = perBuilding.get(b.id) ?? 0; perBuilding.set(b.id, k + 1);
        const a = k * 1.1; lon = b.lon! + Math.cos(a) * .00018 * (1 + k / 6); lat = b.lat! + Math.sin(a) * .00012 * (1 + k / 6);
      }
      pts.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat!] }, properties: { id: d.id, color: d.color, sel: sel.kind === 'equipement' && sel.id === d.id } });
    }
    srcD.setData(fc(p.showDevices ? pts : []));
    m.getCanvas().style.cursor = p.placing ? 'crosshair' : '';
  }, [ready, p.buildings, p.devices, p.showBuildings, p.showDevices, p.selection, p.placing]);

  // Recentrer sur le bâtiment sélectionné.
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    if (p.selection.kind === 'batiment') {
      const b = p.buildings.find(x => x.id === (p.selection as { id: string }).id);
      if (b?.lon !== undefined) m.easeTo({ center: [b.lon, b.lat!], zoom: Math.max(m.getZoom(), 16.5), duration: 800 });
    } else if (p.selection.kind === 'ville') m.easeTo({ center: p.territory.centre, zoom: 14.2, duration: 800 });
  }, [p.selection, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="c-map-wrap">
      <div ref={box} className="c-map" role="application" aria-label={`Carte 3D de ${p.territory.nom}`} />
      {!ready && !error && <div className="c-map-msg" role="status">Chargement de la carte…</div>}
      {error && <div className="c-map-msg" role="alert">{error}</div>}
    </div>
  );
}

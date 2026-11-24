// MapLibre view: OpenFreeMap basemap, AWS Terrarium hillshade, RBMC stations, baselines,
// ellipses and DOM markers for network points. Pure drawing + events; no project logic.
import { TERRARIUM_SOURCE } from '../shared/terrarium.mjs';

export const STYLES = { positron: 'https://tiles.openfreemap.org/styles/positron', liberty: 'https://tiles.openfreemap.org/styles/liberty' };
const DEM_ATTRIBUTION = '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a>';
const STATION_ATTRIBUTION = 'RBMC/IBGE · SIRGAS · NGL';
const empty = () => ({ type: 'FeatureCollection', features: [] });

export function createMapView(container, callbacks) {
  const view = { available: false, map: null, markers: new Map(), data: { cors: empty(), baselines: empty(), ellipses: empty(), effect: empty(), rubber: empty() },
    hillshade: true, styleName: 'positron', lastDragEnd: 0 };
  const gl = window.maplibregl;
  if (!gl) { callbacks.onUnavailable?.('noLibrary'); return view; }
  let map;
  try {
    map = new gl.Map({ container, style: STYLES.positron, center: [-49.19, -25.43], zoom: 10.6, attributionControl: false,
      dragRotate: false, pitchWithRotate: false, maxPitch: 0, fadeDuration: 0 });
  } catch (error) { console.warn('Map initialization failed', error); callbacks.onUnavailable?.('webgl'); return view; }
  view.map = map; view.available = true;
  map.touchZoomRotate.disableRotation();
  map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new gl.ScaleControl({ unit: 'metric' }), 'bottom-right');
  map.addControl(new gl.AttributionControl({ compact: true, customAttribution: STATION_ATTRIBUTION }), 'bottom-right');
  const timeout = setTimeout(() => { if (!map.isStyleLoaded()) callbacks.onUnavailable?.('style'); }, 25000);

  function firstSymbolLayer() { return map.getStyle().layers.find(l => l.type === 'symbol')?.id; }
  function textFont() {
    for (const l of map.getStyle().layers) if (l.type === 'symbol' && Array.isArray(l.layout?.['text-font'])) return l.layout['text-font'];
    return null;
  }
  function install() {
    const before = firstSymbolLayer();
    if (!map.getSource('gnss-dem')) map.addSource('gnss-dem', { ...TERRARIUM_SOURCE, attribution: DEM_ATTRIBUTION });
    if (!map.getLayer('gnss-hillshade')) map.addLayer({ id: 'gnss-hillshade', type: 'hillshade', source: 'gnss-dem',
      layout: { visibility: view.hillshade ? 'visible' : 'none' },
      paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#4f6b73', 'hillshade-highlight-color': '#ffffff' } }, before);
    for (const id of ['cors', 'baselines', 'ellipses', 'effect', 'rubber'])
      if (!map.getSource(`gnss-${id}`)) map.addSource(`gnss-${id}`, { type: 'geojson', data: view.data[id] });
    const add = layer => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    add({ id: 'gnss-ellipses-fill', type: 'fill', source: 'gnss-ellipses', paint: { 'fill-color': '#d9480f', 'fill-opacity': 0.12 } });
    add({ id: 'gnss-ellipses-line', type: 'line', source: 'gnss-ellipses', paint: { 'line-color': '#d9480f', 'line-width': 1.6 } });
    add({ id: 'gnss-baselines-casing', type: 'line', source: 'gnss-baselines', layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 } });
    add({ id: 'gnss-baselines-line', type: 'line', source: 'gnss-baselines', filter: ['!', ['get', 'trivial']], layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 5, 3], 'line-opacity': ['case', ['get', 'included'], 1, 0.45] } });
    add({ id: 'gnss-baselines-trivial', type: 'line', source: 'gnss-baselines', filter: ['get', 'trivial'],
      paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 5, 3], 'line-dasharray': [1.5, 1.2],
        'line-opacity': ['case', ['get', 'included'], 1, 0.45] } });
    add({ id: 'gnss-baselines-hit', type: 'line', source: 'gnss-baselines', paint: { 'line-color': '#000', 'line-width': 16, 'line-opacity': 0 } });
    add({ id: 'gnss-effect', type: 'line', source: 'gnss-effect', paint: { 'line-color': '#c2255c', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
    add({ id: 'gnss-rubber', type: 'line', source: 'gnss-rubber', paint: { 'line-color': '#f2b705', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
    add({ id: 'gnss-cors-circle', type: 'circle', source: 'gnss-cors', paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 5.5, 13, 8],
      'circle-color': ['match', ['get', 'status'], 'active', '#0b4f6c', 'unverified', '#4f8aa0', '#97a6ab'],
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.9 } });
    const font = textFont();
    if (font && map.getStyle().glyphs) add({ id: 'gnss-cors-label', type: 'symbol', source: 'gnss-cors', minzoom: 6,
      layout: { 'text-field': ['get', 'id'], 'text-font': font, 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
      paint: { 'text-color': '#0b4f6c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
  }
  map.on('style.load', () => { install(); callbacks.onStyle?.(); });
  map.on('load', () => { clearTimeout(timeout); install(); callbacks.onReady?.(); });
  map.on('error', event => {
    const message = String(event?.error?.message || '');
    if (event?.sourceId === 'gnss-dem' || message.includes('elevation-tiles-prod')) callbacks.onTerrainError?.();
    else if (!map.isStyleLoaded()) callbacks.onUnavailable?.('style');
  });
  map.on('webglcontextlost', () => callbacks.onUnavailable?.('webgl'));
  const hitLayers = () => ['gnss-baselines-hit', 'gnss-cors-circle'].filter(id => map.getLayer(id));
  map.on('click', event => {
    if (event.originalEvent?.target?.closest?.('.gnss-marker')) return;
    const features = hitLayers().length ? map.queryRenderedFeatures([[event.point.x - 6, event.point.y - 6], [event.point.x + 6, event.point.y + 6]], { layers: hitLayers() }) : [];
    const station = features.find(f => f.layer.id === 'gnss-cors-circle'), baseline = features.find(f => f.layer.id === 'gnss-baselines-hit');
    callbacks.onMapClick?.({ lngLat: event.lngLat, point: event.point, stationId: station?.properties.id ?? null, baselineId: baseline?.properties.id ?? null });
  });
  map.on('mousemove', event => {
    const over = hitLayers().length && map.queryRenderedFeatures(event.point, { layers: hitLayers() }).length;
    map.getCanvas().style.cursor = over ? 'pointer' : '';
    callbacks.onMouseMove?.(event.lngLat);
  });

  view.setSource = (id, data) => { view.data[id] = data; map.getSource(`gnss-${id}`)?.setData(data); };
  view.setHillshade = on => { view.hillshade = on; if (map.getLayer('gnss-hillshade')) map.setLayoutProperty('gnss-hillshade', 'visibility', on ? 'visible' : 'none'); };
  view.setBasemap = name => { if (!STYLES[name] || name === view.styleName) return; view.styleName = name; map.setStyle(STYLES[name], { diff: false }); };
  view.screenDistance = (a, b) => { const p = map.project(a), q = map.project(b); return Math.hypot(p.x - q.x, p.y - q.y); };
  view.fit = (points, padding = 70) => {
    if (!points.length) { map.fitBounds([[-60, -28], [-40, -18]], { duration: 0 }); return; }
    const b = new gl.LngLatBounds();
    points.forEach(p => b.extend([p.lon, p.lat]));
    map.fitBounds(b, { padding, maxZoom: 13.5, duration: 0 });
  };
  view.setMarkers = (items, { draggable }) => {
    const keep = new Set(items.map(i => i.id));
    for (const [id, marker] of view.markers) if (!keep.has(id)) { marker.remove(); view.markers.delete(id); }
    for (const item of items) {
      let marker = view.markers.get(item.id);
      if (!marker) {
        const el = document.createElement('div');
        el.innerHTML = '<span class="dot"></span><span class="tag"></span>';
        el.addEventListener('click', event => {
          event.stopPropagation();
          if (Date.now() - view.lastDragEnd < 250) return;
          callbacks.onMarkerClick?.(el.dataset.id);
        });
        marker = new gl.Marker({ element: el, draggable: false }).setLngLat([item.lon, item.lat]).addTo(map);
        marker.on('dragend', () => { view.lastDragEnd = Date.now(); const ll = marker.getLngLat(); callbacks.onMarkerDragEnd?.(el.dataset.id, ll); });
        view.markers.set(item.id, marker);
      }
      const el = marker.getElement();
      el.dataset.id = item.id;
      // Keep MapLibre's own classes (maplibregl-marker…): only swap ours.
      (el.dataset.cls || '').split(' ').filter(Boolean).forEach(c => el.classList.remove(c));
      const classes = ['gnss-marker', ...item.classes.split(' ').filter(Boolean)];
      classes.forEach(c => el.classList.add(c)); el.dataset.cls = classes.join(' ');
      el.setAttribute('role', 'button'); el.setAttribute('aria-label', item.aria); el.title = item.aria;
      const tag = el.querySelector('.tag'); tag.textContent = item.tag ?? '';
      if (item.sub) { const small = document.createElement('small'); small.textContent = ` ${item.sub}`; tag.append(small); }
      marker.setLngLat([item.lon, item.lat]);
      marker.setDraggable(Boolean(draggable && item.draggable));
    }
  };
  return view;
}

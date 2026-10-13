import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapData = {
  lieux: { id: string; num: number; nom: string; titre: string; lat: number; lng: number }[];
  hebergements: { nom: string; lat: number; lng: number }[];
  legendeHebergement: string;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function pin(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color}"><span>${esc(label)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

export function mountMap(el: HTMLElement, data: MapData): void {
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const css = getComputedStyle(document.documentElement);
  const orange = css.getPropertyValue('--c-principale-fonce').trim();
  const brun = css.getPropertyValue('--c-texte').trim();
  const markers = new Map<string, L.Marker>();
  const points: L.LatLngExpression[] = [];

  for (const l of data.lieux) {
    const m = L.marker([l.lat, l.lng], { icon: pin(orange, String(l.num)), title: l.nom })
      .addTo(map)
      .bindPopup(`<b>${esc(l.titre)}</b><br>${esc(l.nom)}`);
    if (!markers.has(l.id)) markers.set(l.id, m);
    points.push([l.lat, l.lng]);
  }
  for (const h of data.hebergements) {
    L.marker([h.lat, h.lng], { icon: pin(brun, '🛏'), title: h.nom })
      .addTo(map)
      .bindPopup(`<b>${esc(h.nom)}</b><br>${esc(data.legendeHebergement)}`);
    points.push([h.lat, h.lng]);
  }
  map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });

  document.addEventListener('focus-lieu', (e) => {
    const m = markers.get((e as CustomEvent<string>).detail);
    if (!m) return;
    map.setView(m.getLatLng(), 16);
    m.openPopup();
  });
}

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

/** Gainesville, FL -- where the seed data lives. */
const DEFAULT_CENTER = [29.6516, -82.3248];
const DEFAULT_ZOOM = 13;

/**
 * Markers are CSS-drawn `divIcon`s rather than Leaflet's default PNGs. That
 * avoids the bundler-path problem those images have, and lets a pin restyle
 * itself on selection without swapping image files.
 */
const makePin = (modifier) =>
  L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin${modifier}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });

const PIN = makePin('');
const PIN_ACTIVE = makePin(' pin--active');

/** Pans to a site when it is chosen, from the list or from the map. */
function FlyToSite({ site }) {
  const map = useMap();

  useEffect(() => {
    if (!site?.hasLocation) return;
    map.flyTo([site.latitude, site.longitude], Math.max(map.getZoom(), 16), {
      duration: 0.7,
    });
  }, [site, map]);

  return null;
}

/**
 * Frames the current result set after a filter change. Skipped while a site is
 * selected so it cannot yank the view away from what the visitor is reading.
 */
function FitToResults({ sites, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const points = sites.filter((site) => site.hasLocation).map((site) => [site.latitude, site.longitude]);
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
  }, [sites, enabled, map]);

  return null;
}

export default function MapView({ sites, selectedSite, onSelect, origin, radiusKm }) {
  const placeable = useMemo(() => sites.filter((site) => site.hasLocation), [sites]);

  return (
    <MapContainer
      className="map"
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <FitToResults sites={placeable} enabled={!selectedSite} />
      <FlyToSite site={selectedSite} />

      {origin && (
        <Circle
          center={origin}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#b4763a', weight: 1, fillOpacity: 0.06 }}
        />
      )}

      {placeable.map((site) => (
        <Marker
          key={site.id}
          position={[site.latitude, site.longitude]}
          icon={site.id === selectedSite?.id ? PIN_ACTIVE : PIN}
          eventHandlers={{ click: () => onSelect(site) }}
        >
          <Popup>
            <strong>{site.name}</strong>
            {site.category && <div className="popup__meta">{site.category}</div>}
            {site.distanceKm !== undefined && (
              <div className="popup__meta">{site.distanceKm} km away</div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

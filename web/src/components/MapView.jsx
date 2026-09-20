import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, ZoomControl, useMap } from 'react-leaflet';

/** Centre of the Tunisian sites, used only until the first bounds fit lands. */
const FALLBACK_CENTER = [36.65, 10.22];
const FALLBACK_ZOOM = 9;

/**
 * Both basemaps are keyless. CARTO's tiles now return a watermarked
 * "API KEY REQUIRED" image unless you register, so plain OpenStreetMap is used
 * for the street layer instead.
 */
const TILES = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 18,
  },
};

/**
 * Markers are CSS-drawn `divIcon`s rather than Leaflet's default PNGs, which
 * avoids the bundler-path problem those images have. The drop shadow lives in
 * CSS rather than an in-SVG <filter>, so many markers cannot emit the same id.
 */
const makePin = (fill, stroke) =>
  L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M16 2C8.26801 2 2 8.26801 2 16C2 24.5 16 38 16 38C16 38 30 24.5 30 16C30 8.26801 23.732 2 16 2Z"
              fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });

const PIN = makePin('#0284c7', '#0369a1');
const PIN_ACTIVE = makePin('#ef4444', '#991b1b');

/**
 * Frames every matching pin. `bounds` comes from the API and covers the whole
 * filtered set, not just the page on screen, so the map always shows all of it.
 */
function FitBounds({ bounds, suspended }) {
  const map = useMap();
  // A stable string key means the map refits when the extent genuinely changes,
  // not on every render that happens to rebuild the array.
  const key = bounds ? bounds.flat().join(',') : null;

  useEffect(() => {
    // While a pin is open the view belongs to that pin, not to the whole set.
    if (!bounds || suspended) return;

    const box = L.latLngBounds(bounds);
    if (box.getSouthWest().equals(box.getNorthEast())) {
      map.setView(box.getCenter(), Math.max(map.getZoom(), 14));
      return;
    }
    map.fitBounds(box, { padding: [64, 64], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, suspended, map]);

  return null;
}

/**
 * Flies to the chosen site and, when the selection was made in order to open
 * the model page, reports arrival so the page opens once the camera has landed.
 *
 * This is the only thing that moves the camera on selection, so nothing
 * competes for it.
 */
function FlyToSite({ site, shouldOpen, onArrived }) {
  const map = useMap();
  const siteId = site?.id ?? null;

  useEffect(() => {
    if (!siteId) return;

    // Nothing to fly to, so the page may as well open straight away.
    if (!site.hasLocation) {
      if (shouldOpen) onArrived?.();
      return;
    }

    const target = [site.lat, site.lng];

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      map.setView(target, Math.max(map.getZoom(), 15));
      if (shouldOpen) onArrived?.();
      return;
    }

    map.flyTo(target, 15, { duration: 1.2, easeLinearity: 0.25 });
    if (!shouldOpen) return;

    // `moveend` does not fire reliably when a flight is interrupted, so the
    // timeout is the backstop that guarantees the page still opens.
    let settled = false;
    const arrive = () => {
      if (settled) return;
      settled = true;
      onArrived?.();
    };

    const timer = setTimeout(arrive, 1600);
    map.once('moveend', arrive);

    // Cancels a pending open when another pin is clicked mid-flight, or when
    // the user presses Back before the camera lands.
    return () => {
      settled = true;
      clearTimeout(timer);
      map.off('moveend', arrive);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, shouldOpen, map]);

  return null;
}

export default function MapView({ sites, selectedSite, shouldOpen, onArrived, onSelect, tile, bounds }) {
  const placeable = useMemo(() => sites.filter((site) => site.hasLocation), [sites]);
  const layer = TILES[tile] ?? TILES.street;

  return (
    <MapContainer
      className="z-10 h-full w-full"
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      scrollWheelZoom
      zoomControl={false}
    >
      {/* Keyed so switching basemap swaps the layer instead of stacking one on top. */}
      <TileLayer key={tile} url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />

      <ZoomControl position="topright" />
      <FitBounds bounds={bounds} suspended={Boolean(selectedSite)} />
      <FlyToSite site={selectedSite} shouldOpen={shouldOpen} onArrived={onArrived} />

      {placeable.map((site) => {
        const active = site.id === selectedSite?.id;

        return (
          <Marker
            key={site.id}
            position={[site.lat, site.lng]}
            icon={active ? PIN_ACTIVE : PIN}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(site) }}
          />
        );
      })}
    </MapContainer>
  );
}

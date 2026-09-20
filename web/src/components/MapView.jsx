import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';

/** Centre of the Tunisian sites, used only until the first bounds fit lands. */
const FALLBACK_CENTER = [36.65, 10.22];
const FALLBACK_ZOOM = 9;

const TILES = {
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
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
function FitBounds({ bounds }) {
  const map = useMap();
  // A stable string key means the map refits when the extent genuinely changes,
  // not on every render that happens to rebuild the array.
  const key = bounds ? bounds.flat().join(',') : null;

  useEffect(() => {
    if (!bounds) return;

    const box = L.latLngBounds(bounds);
    if (box.getSouthWest().equals(box.getNorthEast())) {
      map.setView(box.getCenter(), Math.max(map.getZoom(), 14));
      return;
    }
    map.fitBounds(box, { padding: [64, 64], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

/** Pans to a site when it is chosen, from the map or from the list. */
function FlyToSite({ site }) {
  const map = useMap();

  useEffect(() => {
    if (!site?.hasLocation) return;
    map.flyTo([site.lat, site.lng], 13, { duration: 1.2, easeLinearity: 0.25 });
  }, [site, map]);

  return null;
}

export default function MapView({ sites, selectedSite, onSelect, tile, bounds }) {
  const placeable = useMemo(() => sites.filter((site) => site.hasLocation), [sites]);
  const layer = TILES[tile] ?? TILES.street;

  return (
    <MapContainer
      className="h-full w-full z-10"
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      scrollWheelZoom
      zoomControl={false}
    >
      {/* Keyed so switching basemap swaps the layer instead of stacking one on top. */}
      <TileLayer key={tile} url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />

      <ZoomControl position="topright" />
      <FitBounds bounds={bounds} />
      <FlyToSite site={selectedSite} />

      {placeable.map((site) => {
        const active = site.id === selectedSite?.id;

        return (
          <Marker
            key={site.id}
            position={[site.lat, site.lng]}
            icon={active ? PIN_ACTIVE : PIN}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(site) }}
          >
            <Popup>
              <div className="min-w-[180px]">
                {site.category && (
                  <span className="inline-block rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
                    {site.category}
                  </span>
                )}
                <h4 className="mt-1 text-sm font-bold text-slate-100">{site.name}</h4>
                {site.location && (
                  <p className="mb-2 text-xs text-slate-400">{site.location}</p>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(site)}
                  className="w-full cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
                >
                  Inspect 3D Scan &rarr;
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

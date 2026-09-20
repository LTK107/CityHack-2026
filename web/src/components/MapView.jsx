import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';

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

/**
 * The full record, over the pin: badges, the scan preview, the description and
 * its key features. `autostart=0` means Sketchfab paints its poster frame and
 * waits for a click, so opening a popup does not start loading a 3D scene.
 */
function SitePopup({ site, onInspect }) {
  const badge = [site.category, site.era].filter(Boolean).join(' · ');

  return (
    <div className="w-[300px] max-w-full">
      <div className="max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
        {badge && (
          <span className="inline-block rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-sky-300 uppercase">
            {badge}
          </span>
        )}

        <div>
          <h4 className="font-serif-title text-base leading-tight font-bold text-slate-100">
            {site.name}
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {site.location}
            {site.hasLocation && (
              <span className="text-slate-500">
                {site.location ? ' ' : ''}({site.lat.toFixed(4)}&deg;N, {site.lng.toFixed(4)}&deg;E)
              </span>
            )}
          </p>
        </div>

        {site.sketchfabUid && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <iframe
              title={`3D scan preview of ${site.name}`}
              src={`https://sketchfab.com/models/${encodeURIComponent(site.sketchfabUid)}/embed?autostart=0&ui_theme=dark&dnt=1&ui_infos=0&ui_controls=0&ui_watermark=0`}
              className="h-full w-full border-0"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              loading="lazy"
            />
          </div>
        )}

        {site.context && (
          <p className="text-[11px] leading-relaxed text-slate-300">{site.context}</p>
        )}

        {site.highlights?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {site.highlights.map((feature) => (
              <span
                key={feature}
                className="rounded border border-slate-700/80 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
              >
                <span className="text-amber-400">&#10070;</span> {feature}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onInspect(site)}
        className="mt-2.5 w-full cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
      >
        Inspect 3D Scan &rarr;
      </button>
    </div>
  );
}

export default function MapView({ sites, selectedSite, onSelect, tile, bounds }) {
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
            <Popup maxWidth={320} minWidth={300} autoPanPadding={[24, 24]}>
              <SitePopup site={site} onInspect={onSelect} />
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

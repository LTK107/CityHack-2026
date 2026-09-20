import { useCallback, useEffect, useMemo, useState } from 'react';
import MapView from './components/MapView.jsx';
import SitePage from './components/SitePage.jsx';
import { fetchHealth, getSite, listCategories, listSites } from './api.js';
import { useDebounced, useRoute } from './hooks.js';

const ALL = 'All';

export default function App() {
  const [health, setHealth] = useState(null);
  const [categories, setCategories] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL);
  const [mapTile, setMapTile] = useState('street');

  const [sites, setSites] = useState([]);
  const [meta, setMeta] = useState(null);
  const [listError, setListError] = useState(null);

  // The pin the camera is on. `pendingOpen` marks a selection made in order to
  // open the model page, so the page waits for the flight to land.
  const [selectedSite, setSelectedSite] = useState(null);
  const [pendingOpen, setPendingOpen] = useState(false);

  // A record fetched by id, for a deep link that the current list does not hold.
  const [deepLinked, setDeepLinked] = useState(null);
  const [deepLinkState, setDeepLinkState] = useState('idle');

  const { siteId, openSite, closeSite } = useRoute();
  const debouncedSearch = useDebounced(searchQuery, 250);

  useEffect(() => {
    const controller = new AbortController();

    const check = async () => {
      const result = await fetchHealth(controller.signal).catch(() => null);
      if (result) setHealth(result);
    };

    check();
    const timer = setInterval(check, 15_000);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    listCategories(controller.signal)
      .then((payload) => setCategories(payload.data ?? []))
      .catch(() => setCategories([]));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    listSites(
      {
        search: debouncedSearch,
        category: selectedCategory === ALL ? '' : selectedCategory,
        limit: 200,
      },
      controller.signal,
    )
      .then((payload) => {
        setSites(payload.data ?? []);
        setMeta(payload.meta ?? null);
        setListError(null);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setSites([]);
        setMeta(null);
        setListError(error.message);
      });

    return () => controller.abort();
  }, [debouncedSearch, selectedCategory]);

  // The open record: whatever the list already holds, else one fetched by id.
  const openRecord = useMemo(
    () => (siteId ? (sites.find((site) => site.id === siteId) ?? deepLinked) : null),
    [siteId, sites, deepLinked],
  );

  // Only fetch when the list genuinely cannot supply the record -- a direct link
  // into a filtered-out or not-yet-loaded site.
  useEffect(() => {
    if (!siteId || sites.some((site) => site.id === siteId)) {
      setDeepLinkState('idle');
      return;
    }
    if (deepLinked?.id === siteId) return;

    const controller = new AbortController();
    setDeepLinkState('loading');

    getSite(siteId, controller.signal)
      .then((payload) => {
        setDeepLinked(payload.data);
        setDeepLinkState('ready');
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setDeepLinkState('missing');
      });

    return () => controller.abort();
  }, [siteId, sites, deepLinked]);

  // Pressing Back while the camera is still flying must cancel the open.
  useEffect(() => {
    if (!siteId) setPendingOpen(false);
  }, [siteId]);

  const handleSelectSite = useCallback((site) => {
    setSelectedSite(site);
    setPendingOpen(true);
  }, []);

  const handleArrived = useCallback(() => {
    setPendingOpen(false);
    setSelectedSite((site) => {
      if (site) openSite(site.id);
      return site;
    });
  }, [openSite]);

  const categoryTabs = [ALL, ...categories.map((entry) => entry.name)];
  const guideEnabled = health?.guide === 'configured';

  const pageStatus = openRecord ? 'ready' : deepLinkState === 'missing' ? 'missing' : 'loading';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-stone-900">
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur-md lg:px-6">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 font-black text-stone-900 shadow-lg shadow-amber-500/20">
            <span className="font-serif-title text-xl">&#66353;</span>
          </div>
          <div>
            <h1 className="font-serif-title flex items-center gap-2 text-lg font-bold tracking-wide text-stone-900 lg:text-xl">
              TANIT XR
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-sans text-xs font-medium text-amber-600">
                Tunisia Heritage
              </span>
            </h1>
            <p className="hidden text-xs text-stone-500 sm:block">
              Open 3D Photogrammetry &amp; Archaeological Scan Archive
            </p>
          </div>
        </div>

        <div className="mx-4 hidden max-w-md flex-1 md:block">
          <div className="relative">
            <input
              type="search"
              placeholder="Search site, era, artifact..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-stone-100/80 py-2 pr-4 pl-9 text-xs text-stone-800 placeholder-stone-400 transition-colors focus:border-amber-500 focus:outline-none"
            />
            <svg
              className="absolute top-2.5 left-3 h-4 w-4 text-stone-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold lg:inline ${
              guideEnabled
                ? 'border-emerald-500/30 text-emerald-600'
                : 'border-stone-300 text-stone-500'
            }`}
          >
            guide {guideEnabled ? 'ready' : 'off'}
          </span>

          <div className="flex rounded-xl border border-stone-200 bg-stone-100/90 p-1 text-xs font-medium">
            {[
              ['street', 'Map'],
              ['satellite', 'Satellite'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMapTile(value)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 transition-all ${
                  mapTile === value
                    ? 'bg-amber-500 font-semibold text-stone-900 shadow'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {listError && (
        <p className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-700 lg:px-6">
          {listError}
        </p>
      )}

      <div className="relative flex-1 overflow-hidden">
        {/* Overlays sit above the map because the map div opens its own
            stacking context at z-10, containing Leaflet's internal z-indexes. */}
        <div className="scrollbar-none pointer-events-auto absolute top-4 right-14 left-4 z-[400] flex gap-2 overflow-x-auto pb-2">
          {categoryTabs.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap backdrop-blur-md transition-all ${
                selectedCategory === category
                  ? 'border-amber-400 bg-amber-500 font-semibold text-stone-900 shadow-lg shadow-stone-900/10'
                  : 'border-stone-300 bg-white/80 text-stone-700 hover:bg-stone-100 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <MapView
          sites={sites}
          selectedSite={selectedSite}
          shouldOpen={pendingOpen}
          onArrived={handleArrived}
          onSelect={handleSelectSite}
          tile={mapTile}
          bounds={meta?.bounds ?? null}
        />

        <div className="absolute right-4 bottom-4 left-4 z-[400] mx-auto hidden max-w-3xl rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-2xl backdrop-blur-md lg:block">
          <div className="mb-2 flex items-center justify-between px-1 text-xs text-stone-500">
            <span className="font-semibold text-stone-700">
              EXPLORE SITES ({meta?.total ?? sites.length})
            </span>
            <span>Click to open the scan</span>
          </div>

          {sites.length === 0 ? (
            <p className="px-1 pb-1 text-xs text-stone-500">No scans match these filters.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => handleSelectSite(site)}
                  className={`w-48 shrink-0 cursor-pointer rounded-xl border p-2.5 text-left text-xs transition-all ${
                    site.id === selectedSite?.id
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-700'
                      : 'border-stone-200 bg-stone-100/70 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <div className="truncate font-semibold">{site.name}</div>
                  <div className="truncate text-[11px] text-stone-500">{site.location}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {siteId && (
        <SitePage
          site={openRecord}
          status={pageStatus}
          guideEnabled={guideEnabled}
          onClose={closeSite}
        />
      )}
    </div>
  );
}

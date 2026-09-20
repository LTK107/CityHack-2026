import { useEffect, useMemo, useRef, useState } from 'react';
import Filters from './components/Filters.jsx';
import MapView from './components/MapView.jsx';
import SiteDetail from './components/SiteDetail.jsx';
import SiteList from './components/SiteList.jsx';
import { fetchHealth, listCategories, listSites } from './api.js';
import { useDebounced } from './hooks.js';

const INITIAL_FILTERS = {
  search: '',
  category: '',
  maxCost: '',
  near: '',
  radiusKm: 25,
  sort: 'name',
  order: 'asc',
};

function StatusPill({ health }) {
  if (!health) return <span className="pill pill--muted">checking...</span>;

  const database = health.database === 'up';
  return (
    <div className="status">
      <span className={`pill ${database ? 'pill--ok' : 'pill--bad'}`}>
        database {database ? 'up' : 'down'}
      </span>
      <span className={`pill ${health.guide === 'configured' ? 'pill--ok' : 'pill--muted'}`}>
        guide {health.guide === 'configured' ? 'ready' : 'off'}
      </span>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [categories, setCategories] = useState([]);

  const [sites, setSites] = useState([]);
  const [meta, setMeta] = useState(null);
  const [listState, setListState] = useState('loading');
  const [listError, setListError] = useState(null);

  const [selectedSite, setSelectedSite] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Bumped to force a refetch: the retry button, and the moment the database
  // comes back after being down.
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebounced(filters.search, 300);
  const previousDatabase = useRef(null);

  // Poll /health so the banner clears itself once Postgres is running, without
  // the visitor needing to reload the page.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const check = async () => {
      const result = await fetchHealth(controller.signal).catch(() => null);
      if (cancelled || !result) return;

      setHealth(result);
      if (previousDatabase.current && previousDatabase.current !== 'up' && result.database === 'up') {
        setReloadKey((key) => key + 1);
      }
      previousDatabase.current = result.database;
    };

    check();
    const timer = setInterval(check, 15_000);

    return () => {
      cancelled = true;
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
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setListState('loading');

    listSites(
      {
        search: debouncedSearch,
        category: filters.category,
        maxCost: filters.maxCost,
        near: filters.near,
        radiusKm: filters.near ? filters.radiusKm : undefined,
        sort: filters.sort,
        order: filters.order,
        limit: 200,
      },
      controller.signal,
    )
      .then((payload) => {
        setSites(payload.data ?? []);
        setMeta(payload.meta ?? null);
        setListState('ready');
        setListError(null);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setSites([]);
        setListError(error.message);
        setListState('error');
      });

    return () => controller.abort();
  }, [
    debouncedSearch,
    filters.category,
    filters.maxCost,
    filters.near,
    filters.radiusKm,
    filters.sort,
    filters.order,
    reloadKey,
  ]);

  const origin = useMemo(() => {
    if (!filters.near) return null;
    const [lat, lng] = filters.near.split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [filters.near]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError('This browser cannot share a location.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // Fixed decimals: the API validates `near` against a strict lat,lng pattern.
        setFilters((prev) => ({
          ...prev,
          near: `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`,
        }));
        setLocating(false);
      },
      (error) => {
        setLocationError(error.message || 'Could not read your location.');
        setLocating(false);
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const databaseDown = health && health.database !== 'up';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1 className="brand__title">Heritage Map</h1>
            <p className="brand__subtitle">CityHack 2026 &middot; Gainesville</p>
          </div>
        </div>
        <StatusPill health={health} />
      </header>

      {databaseDown && (
        <p className="banner">
          {health.unreachable
            ? 'The API is not responding on port 4000. Start it with npm run dev from the project root.'
            : 'The API is running but cannot reach PostgreSQL, so no sites will load. Start the database \u2014 this banner clears itself.'}
        </p>
      )}

      <main className="layout">
        <section className="sidebar">
          <Filters
            filters={filters}
            onChange={setFilters}
            categories={categories}
            locating={locating}
            locationError={locationError}
            onUseMyLocation={useMyLocation}
            onClearLocation={() => setFilters((prev) => ({ ...prev, near: '' }))}
          />

          <SiteList
            sites={sites}
            meta={meta}
            state={listState}
            error={listError}
            selectedId={selectedSite?.id}
            onSelect={setSelectedSite}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        </section>

        <div className="stage">
          <MapView
            sites={sites}
            selectedSite={selectedSite}
            onSelect={setSelectedSite}
            origin={origin}
            radiusKm={filters.radiusKm}
          />

          {selectedSite && (
            <SiteDetail
              site={selectedSite}
              guideEnabled={health?.guide === 'configured'}
              onClose={() => setSelectedSite(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

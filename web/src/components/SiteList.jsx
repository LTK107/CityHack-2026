import { formatCost, formatDistance } from '../format.js';

export default function SiteList({ sites, meta, state, error, selectedId, onSelect, onRetry }) {
  if (state === 'loading' && sites.length === 0) {
    return <p className="notice">Loading sites...</p>;
  }

  if (state === 'error') {
    return (
      <div className="notice notice--error">
        <p>{error}</p>
        <button type="button" className="button button--ghost" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (sites.length === 0) {
    return <p className="notice">No sites match these filters.</p>;
  }

  return (
    <>
      <p className="list__count">
        Showing {sites.length}
        {meta && meta.total > sites.length ? ` of ${meta.total}` : ''} site
        {sites.length === 1 ? '' : 's'}
      </p>

      <ul className="list">
        {sites.map((site) => {
          const cost = formatCost(site);
          const distance = formatDistance(site.distanceKm);

          return (
            <li key={site.id}>
              <button
                type="button"
                className={`card${site.id === selectedId ? ' card--active' : ''}`}
                onClick={() => onSelect(site)}
                aria-current={site.id === selectedId}
              >
                <span className="card__title">{site.name}</span>
                {site.shortDescription && (
                  <span className="card__blurb">{site.shortDescription}</span>
                )}
                <span className="card__tags">
                  {site.category && <span className="tag">{site.category}</span>}
                  {cost && <span className={`tag${cost === 'Free' ? ' tag--free' : ''}`}>{cost}</span>}
                  {distance && <span className="tag tag--muted">{distance}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

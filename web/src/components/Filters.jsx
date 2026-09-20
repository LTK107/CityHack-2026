const COST_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: '0', label: 'Free only' },
  { value: '10', label: 'Under $10' },
  { value: '25', label: 'Under $25' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'admissionCost', label: 'Price' },
];

export default function Filters({
  filters,
  onChange,
  categories,
  onUseMyLocation,
  onClearLocation,
  locating,
  locationError,
}) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="filters">
      <label className="field">
        <span className="field__label">Search</span>
        <input
          type="search"
          className="field__input"
          placeholder="Name, description, address..."
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Category</span>
          <select
            className="field__input"
            value={filters.category}
            onChange={(event) => set({ category: event.target.value })}
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.name} value={category.name}>
                {category.name} ({category.count})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Admission</span>
          <select
            className="field__input"
            value={filters.maxCost}
            onChange={(event) => set({ maxCost: event.target.value })}
          >
            {COST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Sort by</span>
          <select
            className="field__input"
            value={filters.sort}
            disabled={Boolean(filters.near)}
            onChange={(event) => set({ sort: event.target.value })}
            title={filters.near ? 'Nearby results are always sorted by distance' : undefined}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field__label">Proximity</span>
          {filters.near ? (
            <button type="button" className="button button--ghost" onClick={onClearLocation}>
              Clear nearby
            </button>
          ) : (
            <button
              type="button"
              className="button button--ghost"
              onClick={onUseMyLocation}
              disabled={locating}
            >
              {locating ? 'Locating...' : 'Near me'}
            </button>
          )}
        </div>
      </div>

      {filters.near && (
        <label className="field">
          <span className="field__label">
            Within <strong>{filters.radiusKm} km</strong>
          </span>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={filters.radiusKm}
            onChange={(event) => set({ radiusKm: Number(event.target.value) })}
          />
        </label>
      )}

      {locationError && <p className="notice notice--warn">{locationError}</p>}
    </div>
  );
}

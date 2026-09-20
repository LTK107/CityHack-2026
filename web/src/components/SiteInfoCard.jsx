/**
 * The record, bottom-left over the scan: everything sites.json holds for a site
 * except its id. Scrolls internally so a long context cannot run off a short
 * screen.
 */
export default function SiteInfoCard({ site, onBackToMap }) {
  const badge = [site.category, site.era].filter(Boolean).join(' · ');

  return (
    <div className="pointer-events-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-stone-300 bg-white/90 shadow-2xl shadow-stone-900/10 backdrop-blur-md">
      <div className="max-h-[min(60vh,32rem)] space-y-3 overflow-y-auto p-4 lg:p-5">
        <div>
          {badge && (
            <span className="inline-block rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-600 uppercase">
              {badge}
            </span>
          )}

          <h1 className="font-serif-title mt-1.5 text-xl leading-tight font-bold text-stone-900 lg:text-2xl">
            {site.name}
          </h1>

          {(site.location || site.hasLocation) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-amber-700/80">
              {site.location && <span>{site.location}</span>}
              {site.hasLocation && (
                <span className="text-stone-500">
                  ({site.lat.toFixed(4)}&deg;N, {site.lng.toFixed(4)}&deg;E)
                </span>
              )}
            </p>
          )}
        </div>

        {site.context && (
          <div>
            <h2 className="mb-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
              Historical Context
            </h2>
            <p className="text-xs leading-relaxed text-stone-700">{site.context}</p>
          </div>
        )}

        {site.highlights?.length > 0 && (
          <div>
            <h2 className="mb-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
              Key Archaeological Features
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {site.highlights.map((feature) => (
                <span
                  key={feature}
                  className="flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-100 px-2 py-1 text-[11px] text-stone-700"
                >
                  <span className="text-amber-600">&#10070;</span> {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-2.5 text-[11px]">
          {site.sourceUrl ? (
            <a
              href={site.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-600 transition-colors hover:text-amber-700"
            >
              View on Sketchfab &#8599;
            </a>
          ) : (
            <span className="text-stone-500">No source link</span>
          )}
          {site.sketchfabUid && (
            <span className="text-stone-500">UID: {site.sketchfabUid.slice(0, 8)}...</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onBackToMap}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-b-2xl border-t border-stone-200 bg-stone-100/70 px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-amber-700"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        Back to the map
      </button>
    </div>
  );
}

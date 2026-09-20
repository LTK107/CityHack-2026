import SketchfabEmbed from './SketchfabEmbed.jsx';

function EmptyState({ sites, onSelect }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center space-y-6 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800 shadow-xl shadow-slate-950">
        <img src="/mura.svg" alt="" width="52" height="64" aria-hidden="true" />
      </div>

      <div className="max-w-md space-y-2">
        <h3 className="font-serif-title text-xl font-bold text-amber-100">Tanit XR Site Inspector</h3>
        <p className="text-xs leading-relaxed text-slate-400">
          Select any map pin across Tunisia or choose a featured scan below. Mura will appear to
          tell you about it.
        </p>
      </div>

      <div className="w-full space-y-2 pt-4 text-left">
        <span className="block text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Featured Digital Heritage Scans
        </span>

        <div className="grid grid-cols-1 gap-2">
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => onSelect(site)}
              className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 text-left transition-all hover:border-amber-500/50 hover:bg-slate-800"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-200 group-hover:text-amber-300">
                  {site.name}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {[site.location, site.category].filter(Boolean).join(' • ')}
                </div>
              </div>
              <span className="ml-3 shrink-0 text-xs text-slate-500 transition-colors group-hover:text-amber-400">
                Inspect &rarr;
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Inspector({ site, sites, onClose, onSelect }) {
  if (!site) return <EmptyState sites={sites} onSelect={onSelect} />;

  return (
    <div className="flex flex-col space-y-5 p-4 lg:p-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-xs font-bold tracking-wider text-amber-400 uppercase">
            {[site.category, site.era].filter(Boolean).join(' • ') || 'Heritage scan'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            Close Inspector &#10005;
          </button>
        </div>

        <h2 className="font-serif-title text-xl font-bold text-slate-100 lg:text-2xl">{site.name}</h2>

        {(site.location || site.hasLocation) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-amber-200/70">
            {site.location && <span>{site.location}</span>}
            {site.hasLocation && (
              <span className="text-slate-500">
                ({site.lat.toFixed(4)}&deg;N, {site.lng.toFixed(4)}&deg;E)
              </span>
            )}
          </p>
        )}
      </div>

      <div className="relative aspect-video min-h-[280px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <SketchfabEmbed uid={site.sketchfabUid} name={site.name} />
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
        <h3 className="text-xs font-bold tracking-wider text-amber-400 uppercase">
          Historical Context
        </h3>
        <p className="text-xs leading-relaxed text-slate-300 lg:text-sm">
          {site.context ?? 'No context recorded for this scan yet.'}
        </p>
      </div>

      {site.highlights?.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            Key Archaeological Features
          </h3>
          <div className="flex flex-wrap gap-2">
            {site.highlights.map((feature) => (
              <span
                key={feature}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800 px-3 py-1.5 text-xs text-slate-300"
              >
                <span className="text-amber-400">&#10070;</span> {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
        {site.sourceUrl ? (
          <a
            href={site.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-amber-400 transition-colors hover:text-amber-300"
          >
            View on Sketchfab &#8599;
          </a>
        ) : (
          <span className="text-slate-500">No source link</span>
        )}
        {site.sketchfabUid && (
          <span className="text-slate-500">UID: {site.sketchfabUid.slice(0, 8)}...</span>
        )}
      </div>
    </div>
  );
}

/**
 * The catalogue stores a bare Sketchfab uid, so the embed URL is built here
 * rather than trusted from the data file.
 *
 * `autostart=1` loads and spins the scene straight away, so a visitor never
 * meets a poster frame with a play button.
 */
export default function SketchfabEmbed({ uid, name, compact = false }) {
  if (!uid) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-white p-4 text-center">
        <p className="text-xs font-semibold text-stone-800">No 3D scan linked yet</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-stone-500">
          Add a <code className="text-amber-700">sketchfabUid</code> for this record in{' '}
          <code className="text-amber-700">server/data/sites.json</code>.
        </p>
        <a
          href={`https://sketchfab.com/search?q=${encodeURIComponent(name)}&type=models`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-stone-300 bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700 transition-colors hover:border-amber-500/60 hover:text-amber-700"
        >
          Search Sketchfab &#8599;
        </a>
      </div>
    );
  }

  const params = new URLSearchParams({
    autostart: '1',
    autospin: '0.2',
    dnt: '1',
    ui_infos: '0',
    ui_watermark: '0',
    // A popup-sized viewer has no room for the full control strip.
    ui_controls: compact ? '0' : '1',
    ui_hint: '0',
    preload: '1',
    // Let the page's own white backdrop show through instead of the model's
    // dark scene background. `ui_theme` is left at its light default to match.
    transparent: '1',
  });

  return (
    <iframe
      title={`3D scan of ${name}`}
      src={`https://sketchfab.com/models/${encodeURIComponent(uid)}/embed?${params}`}
      className="h-full w-full border-0"
      allow="autoplay; fullscreen; vr; xr-spatial-tracking"
      allowFullScreen
    />
  );
}

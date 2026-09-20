/**
 * The catalogue stores a bare Sketchfab uid, so the embed URL is built here
 * rather than trusted from the data file.
 */
export default function SketchfabEmbed({ uid, name }) {
  if (!uid) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-3xl">&#127963;</span>
        <p className="text-sm font-semibold text-slate-200">No 3D scan linked yet</p>
        <p className="max-w-xs text-xs leading-relaxed text-slate-400">
          Add a <code className="text-amber-400">sketchfabUid</code> for this record in{' '}
          <code className="text-amber-400">server/data/sites.json</code>.
        </p>
        <a
          href={`https://sketchfab.com/search?q=${encodeURIComponent(name)}&type=models`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-500/50 hover:text-amber-300"
        >
          Search Sketchfab &#8599;
        </a>
      </div>
    );
  }

  // dnt=1 asks Sketchfab not to track the embed's viewers.
  const src =
    `https://sketchfab.com/models/${encodeURIComponent(uid)}/embed` +
    '?autostart=1&ui_theme=dark&dnt=1&ui_controls=1&ui_infos=0';

  return (
    <iframe
      title={`3D scan of ${name}`}
      src={src}
      className="h-full w-full border-0"
      allow="autoplay; fullscreen; vr; xr-spatial-tracking"
      allowFullScreen
    />
  );
}

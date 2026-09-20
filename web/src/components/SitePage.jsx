import MuraOverlay from './MuraOverlay.jsx';
import SiteInfoCard from './SiteInfoCard.jsx';
import SketchfabEmbed from './SketchfabEmbed.jsx';

/**
 * The model page: the scan fills the viewport and every other element floats
 * over it. No docked panels.
 *
 * It renders as an overlay above the still-mounted map, so closing it reveals
 * the map exactly where it was left -- zoomed in on the pin just visited --
 * rather than re-initialising Leaflet and refitting to the whole catalogue.
 */
export default function SitePage({ site, status, guideEnabled, onClose }) {
  if (status !== 'ready') {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-white p-6 text-center">
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            {status === 'loading' ? 'Loading scan...' : 'That scan is not in the catalogue.'}
          </p>
          {status !== 'loading' && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-400"
            >
              Back to the map
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-white">
      <div className="absolute inset-0">
        <SketchfabEmbed uid={site.sketchfabUid} name={site.name} />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close and return to the map"
        className="absolute top-4 right-4 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-stone-300 bg-white/90 text-lg text-stone-700 shadow-lg backdrop-blur-md transition-colors hover:border-amber-500/50 hover:text-amber-700"
      >
        &#10005;
      </button>

      {/*
        One overlay: the card bottom-left, Mura to the right. Pointer events are
        off on the container so the scan stays draggable in the gap between them.

        Mura is mounted exactly once -- a second instance would run `useGuide`
        again and spend two Gemini calls on every open. On a phone the row would
        collide, so `flex-col-reverse` stacks her above the card instead.
      */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col-reverse items-end justify-end gap-3 p-4 sm:flex-row sm:items-end sm:justify-between lg:p-6">
        <SiteInfoCard site={site} onBackToMap={onClose} />
        <MuraOverlay site={site} enabled={guideEnabled} />
      </div>
    </div>
  );
}

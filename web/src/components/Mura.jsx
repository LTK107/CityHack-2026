import { useEffect, useRef, useState } from 'react';
import { useGuide } from '../hooks.js';

/**
 * Mura: the guide who appears when a visitor opens a pin, with her chat bubble
 * sitting over her head. The conversation is Gemini-backed through /api/chat,
 * which builds the model's facts from the catalogue rather than the request.
 *
 * The artwork is /mura.svg in public/ -- swap that file to change the avatar.
 */
export default function Mura({ site, enabled, onDismiss }) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const threadRef = useRef(null);

  const { messages, followUps, error, busy, send, retry } = useGuide(site, enabled);

  // A new site reopens her, so she is not left minimised on the next pin.
  useEffect(() => setOpen(true), [site?.id]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, busy, open]);

  if (!site) return null;

  const greeting = enabled
    ? 'Let me tell you about this place...'
    : 'I am resting. Set GEMINI_API_KEY on the server and restart it to wake me.';

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-[500] flex flex-col items-end gap-1.5 lg:bottom-36">
      {open && (
        <div className="pointer-events-auto w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
            <div className="min-w-0">
              <p className="font-serif-title text-sm font-bold text-amber-200">Mura</p>
              <p className="truncate text-[10px] text-slate-500">Guide &middot; {site.name}</p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss Mura"
              className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              &#10005;
            </button>
          </div>

          <div ref={threadRef} className="max-h-56 space-y-2 overflow-y-auto px-3 py-2.5">
            {messages.length === 0 && !busy && !error && (
              <p className="text-xs leading-relaxed text-slate-400">{greeting}</p>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === 'user'
                    ? 'ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-amber-500 px-2.5 py-1.5 text-xs font-medium whitespace-pre-wrap text-slate-950'
                    : 'w-fit max-w-[92%] rounded-xl rounded-bl-sm border border-slate-800 bg-slate-800/60 px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap text-slate-200'
                }
              >
                {message.content}
              </div>
            ))}

            {busy && (
              <div className="flex w-fit gap-1 rounded-xl rounded-bl-sm border border-slate-800 bg-slate-800/60 px-2.5 py-2.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                    style={{ animationDelay: `${dot * 180}ms` }}
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-200">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-1.5 cursor-pointer rounded border border-red-500/40 px-2 py-0.5 font-semibold transition-colors hover:bg-red-500/20"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {followUps.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {followUps.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className="cursor-pointer rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-left text-[10px] text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex gap-1.5 border-t border-slate-800 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim() && !busy && enabled) {
                send(draft);
                setDraft('');
              }
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={enabled ? 'Ask Mura anything...' : 'Guide offline'}
              maxLength={1000}
              disabled={busy || !enabled}
              className="min-w-0 flex-1 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 transition-colors focus:border-amber-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !enabled}
              className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-default disabled:opacity-40"
            >
              Ask
            </button>
          </form>

          {/* Tail pointing down at Mura's head. */}
          <div className="relative h-0">
            <div className="absolute right-8 -bottom-[7px] h-3 w-3 rotate-45 border-r border-b border-slate-700/80 bg-slate-900" />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Hide Mura' : 'Talk to Mura'}
        aria-expanded={open}
        className="pointer-events-auto cursor-pointer rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
      >
        <img
          src="/mura.svg"
          alt="Mura, your guide"
          width="84"
          height="104"
          className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
        />
      </button>

      {!open && (
        <span className="pointer-events-none rounded-full bg-slate-900/90 px-2 py-0.5 text-[10px] font-medium text-amber-300">
          Talk to Mura
        </span>
      )}
    </div>
  );
}

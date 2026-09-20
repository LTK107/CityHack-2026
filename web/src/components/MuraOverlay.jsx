import { useEffect, useRef, useState } from 'react';
import { useGuide } from '../hooks.js';

/**
 * Mura on the model page: floating over the scan rather than docked in a panel,
 * with her speech bubble over her head and the figure beneath it.
 *
 * The conversation is Gemini-backed through /api/chat, which builds the model's
 * facts from the catalogue rather than from anything the browser sends. Her
 * artwork is /mura.svg in public/ -- swap that one file to change her.
 */
export default function MuraOverlay({ site, enabled }) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const threadRef = useRef(null);

  const { messages, followUps, error, busy, send, retry } = useGuide(site, enabled);

  // The model's own follow-ups win once it has answered; until then (and if it
  // never does) the catalogue's hand-written openers stand in.
  const chips = followUps.length > 0 ? followUps : (site?.suggestedQuestions ?? []);

  useEffect(() => setOpen(true), [site?.id]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, busy, open]);

  return (
    <div className="pointer-events-none flex max-h-full w-[min(22rem,calc(100vw-2rem))] flex-col items-center justify-end gap-1">
      {open && (
        <div className="pointer-events-auto relative flex min-h-0 w-full flex-col rounded-3xl border border-stone-300 bg-white/95 shadow-2xl shadow-stone-900/10 backdrop-blur-md">
          <div className="flex items-baseline justify-between gap-2 border-b border-stone-200 px-4 py-2.5">
            <p className="font-serif-title text-sm font-bold text-amber-700">Mura</p>
            <p className="truncate text-[10px] text-stone-500">Your guide</p>
          </div>

          <div ref={threadRef} className="max-h-[38vh] min-h-0 space-y-2 overflow-y-auto px-4 py-3">
            {!enabled && (
              <p className="rounded-xl border border-stone-200 bg-stone-100/60 p-3 text-xs leading-relaxed text-stone-500">
                I am resting. Set <code className="text-amber-600">GEMINI_API_KEY</code> in{' '}
                <code className="text-amber-600">server/.env</code> and restart the API to wake me.
              </p>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === 'user'
                    ? 'ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-amber-500 px-3 py-1.5 text-xs font-medium whitespace-pre-wrap text-stone-900'
                    : 'w-fit max-w-[92%] rounded-2xl rounded-bl-sm border border-stone-200 bg-stone-100/70 px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap text-stone-800'
                }
              >
                {message.content}
              </div>
            ))}

            {busy && (
              <div className="flex w-fit gap-1 rounded-2xl rounded-bl-sm border border-stone-200 bg-stone-100/70 px-3 py-2.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400"
                    style={{ animationDelay: `${dot * 180}ms` }}
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-[11px] text-red-700">
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

          {chips.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1 px-4 pb-2">
              {chips.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className="cursor-pointer rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-left text-[10px] text-amber-700 transition-colors hover:bg-amber-500/20"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex gap-1.5 border-t border-stone-200 p-2.5"
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
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-stone-100/80 px-2.5 py-1.5 text-xs text-stone-800 placeholder-stone-400 transition-colors focus:border-amber-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !enabled}
              className="cursor-pointer rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-900 transition-colors hover:bg-amber-400 disabled:cursor-default disabled:opacity-40"
            >
              Ask
            </button>
          </form>

          {/* Tail pointing down at Mura's head. */}
          <div
            className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-r border-b border-stone-300 bg-white"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Collapsing her keeps the scan clear on a phone, where she would
          otherwise cover most of it. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Hide Mura' : 'Talk to Mura'}
        aria-expanded={open}
        className="pointer-events-auto shrink-0 cursor-pointer rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
      >
        <img
          src="/mura.svg"
          alt="Mura, your guide"
          className="h-auto w-28 drop-shadow-[0_10px_18px_rgba(87,70,55,0.22)] lg:w-36"
        />
      </button>

      {!open && (
        <span className="pointer-events-none rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          Talk to Mura
        </span>
      )}
    </div>
  );
}

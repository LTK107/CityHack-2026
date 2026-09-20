import { useEffect, useRef, useState } from 'react';
import { askGuide } from '../api.js';

export default function GuideChat({ site, enabled }) {
  const [messages, setMessages] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const threadRef = useRef(null);
  const controllerRef = useRef(null);
  // Guards the opening request against StrictMode's double-invoked effects,
  // which would otherwise spend two Gemini calls on every mount.
  const openedFor = useRef(null);

  const busy = status === 'loading';

  async function send(text) {
    const outgoing = text?.trim() ?? '';
    const history = messages;

    if (outgoing) setMessages((prev) => [...prev, { role: 'user', content: outgoing }]);
    setDraft('');
    setFollowUps([]);
    setError(null);
    setStatus('loading');

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const payload = await askGuide(
        { siteId: site.id, message: outgoing, history },
        controller.signal,
      );
      setMessages((prev) => [...prev, { role: 'model', content: payload.data.reply }]);
      setFollowUps(payload.data.followUps ?? []);
      setStatus('idle');
    } catch (cause) {
      if (cause?.name === 'AbortError') return;
      setError(cause.message);
      setStatus('error');
    }
  }

  // Opening the guide asks for the site summary -- the API treats an empty
  // message as "introduce this place".
  useEffect(() => {
    if (!enabled) return;
    if (openedFor.current === site.id) return;
    openedFor.current = site.id;

    setMessages([]);
    setFollowUps([]);
    send('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id, enabled]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, status]);

  if (!enabled) {
    return (
      <p className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4 text-xs leading-relaxed text-slate-400">
        The guide is offline. Set <code className="text-amber-400">GEMINI_API_KEY</code> in{' '}
        <code className="text-amber-400">server/.env</code> and restart the API to enable it.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div ref={threadRef} className="flex min-h-[180px] flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'max-w-[88%] self-end rounded-2xl rounded-br-sm bg-amber-500 px-3 py-2 text-xs font-medium whitespace-pre-wrap text-slate-950'
                : 'max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-800/50 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-slate-200'
            }
          >
            {message.content}
          </div>
        ))}

        {busy && (
          <div className="flex gap-1 self-start rounded-2xl rounded-bl-sm border border-slate-800 bg-slate-800/50 px-3 py-3">
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
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => send('')}
              className="mt-2 cursor-pointer rounded-md border border-red-500/40 px-2.5 py-1 font-semibold transition-colors hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {followUps.length > 0 && !busy && (
        <div className="flex flex-wrap gap-1.5">
          {followUps.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => send(question)}
              className="cursor-pointer rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-left text-[11px] text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() && !busy) send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Ask about ${site.name}...`}
          maxLength={1000}
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 transition-colors focus:border-amber-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-default disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

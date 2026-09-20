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
      <p className="notice notice--warn">
        The guide is offline. Set <code>GEMINI_API_KEY</code> in <code>server/.env</code> and
        restart the API to enable it.
      </p>
    );
  }

  return (
    <div className="chat">
      <div className="chat__thread" ref={threadRef}>
        {messages.map((message, index) => (
          <div key={index} className={`bubble bubble--${message.role}`}>
            {message.content}
          </div>
        ))}

        {busy && (
          <div className="bubble bubble--model bubble--pending">
            <span className="dots"><i /><i /><i /></span>
          </div>
        )}

        {error && (
          <div className="notice notice--error">
            <p>{error}</p>
            <button type="button" className="button button--ghost" onClick={() => send('')}>
              Retry
            </button>
          </div>
        )}
      </div>

      {followUps.length > 0 && !busy && (
        <div className="chips">
          {followUps.map((question) => (
            <button
              key={question}
              type="button"
              className="chip"
              onClick={() => send(question)}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() && !busy) send(draft);
        }}
      >
        <input
          className="field__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Ask about ${site.name}...`}
          maxLength={1000}
          disabled={busy}
        />
        <button type="submit" className="button" disabled={busy || !draft.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}

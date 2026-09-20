import { useCallback, useEffect, useRef, useState } from 'react';
import { askGuide } from './api.js';

/** Delays a fast-changing value so typing does not fire a request per keystroke. */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Which site the URL is pointing at, as `?site=<id>`.
 *
 * Built on the History API rather than a router dependency: the model page is a
 * real URL, so the browser Back button returns to the map and a link can be
 * pasted into a fresh tab.
 */
export function useRoute() {
  const read = () => new URLSearchParams(window.location.search).get('site');
  const [siteId, setSiteId] = useState(read);

  useEffect(() => {
    // Fires for Back/Forward, which push/replace do not raise themselves.
    const sync = () => setSiteId(read());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const openSite = useCallback((id) => {
    window.history.pushState({ site: id }, '', `?site=${encodeURIComponent(id)}`);
    setSiteId(String(id));
  }, []);

  const closeSite = useCallback(() => {
    window.history.pushState({}, '', window.location.pathname);
    setSiteId(null);
  }, []);

  return { siteId, openSite, closeSite };
}

/**
 * The Gemini-backed conversation about one site.
 *
 * Opening a site asks the API for its summary -- an empty message means
 * "introduce this place" -- and every later turn carries the prior history so
 * the model keeps context. Site facts come from the catalogue server-side, so
 * nothing here can feed the model invented details.
 */
export function useGuide(site, enabled) {
  const [messages, setMessages] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);
  const messagesRef = useRef(messages);
  // Guards the opening request against StrictMode's double-invoked effects,
  // which would otherwise spend two Gemini calls on every mount.
  const openedFor = useRef(null);

  messagesRef.current = messages;

  const siteId = site?.id ?? null;

  const send = useCallback(
    async (text) => {
      if (!siteId) return;

      const outgoing = text?.trim() ?? '';
      // Read through a ref so `send` stays stable and effects do not re-fire.
      const history = messagesRef.current;

      if (outgoing) setMessages((prev) => [...prev, { role: 'user', content: outgoing }]);
      setFollowUps([]);
      setError(null);
      setStatus('loading');

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const payload = await askGuide(
          { siteId, message: outgoing, history },
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
    },
    [siteId],
  );

  useEffect(() => {
    if (!siteId || !enabled) return;
    if (openedFor.current === siteId) return;
    openedFor.current = siteId;

    messagesRef.current = [];
    setMessages([]);
    setFollowUps([]);
    send('');
  }, [siteId, enabled, send]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    messages,
    followUps,
    error,
    status,
    busy: status === 'loading',
    send,
    retry: () => send(''),
  };
}

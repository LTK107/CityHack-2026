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
 * Generic, site-agnostic openers shown the moment the guide appears. They are
 * static, so displaying them costs nothing -- the model is only ever called once
 * the visitor sends (or taps) an actual question.
 */
const STARTER_QUESTIONS = [
  'Tell me about this place.',
  'Why is it historically important?',
  'What should I look for here?',
];

/**
 * The conversation about one site, backed by the NaviGator (LiteLLM) gateway.
 *
 * Selecting a site does NOT call the model: it just resets to a generic greeting
 * plus the starter questions above, so no tokens are spent until the visitor
 * asks something. Every real turn carries the prior history so the model keeps
 * context. Site facts come from the catalogue server-side, so nothing here can
 * feed the model invented details.
 */
export function useGuide(site, enabled) {
  const [messages, setMessages] = useState([]);
  const [followUps, setFollowUps] = useState(STARTER_QUESTIONS);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);
  const messagesRef = useRef(messages);

  messagesRef.current = messages;

  const siteId = site?.id ?? null;

  const send = useCallback(
    async (text) => {
      const outgoing = text?.trim() ?? '';
      // No site, no question, no call -- this is what keeps load-time token use at
      // zero: the greeting and starters never reach the model.
      if (!siteId || !outgoing) return;

      // Read through a ref so `send` stays stable and effects do not re-fire.
      const history = messagesRef.current;

      setMessages((prev) => [...prev, { role: 'user', content: outgoing }]);
      setFollowUps([]);
      setError(null);
      setStatus('loading');

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const payload = await askGuide({ siteId, message: outgoing, history }, controller.signal);
        setMessages((prev) => [...prev, { role: 'model', content: payload.data.reply }]);
        setFollowUps(payload.data.followUps ?? []);
        setStatus('idle');
      } catch (cause) {
        if (cause?.name === 'AbortError') {
          // If a newer request already replaced this controller, that request owns
          // the loading state. Otherwise (e.g. aborted by a site switch) release
          // the spinner back to idle so the guide is never wedged.
          if (controllerRef.current === controller) setStatus('idle');
          return;
        }
        setError(cause.message);
        setStatus('error');
      }
    },
    [siteId],
  );

  // Switching sites resets to the generic starter state. This never calls the
  // model, so opening a new pin costs nothing until the visitor speaks.
  useEffect(() => {
    controllerRef.current?.abort();
    messagesRef.current = [];
    setMessages([]);
    setFollowUps(STARTER_QUESTIONS);
    setError(null);
    setStatus('idle');
  }, [siteId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Re-send the last question the visitor asked, dropping the failed turn first so
  // it is not duplicated in the thread.
  const retry = useCallback(() => {
    const prev = messagesRef.current;
    const idx = prev.map((m) => m.role).lastIndexOf('user');
    if (idx < 0) return;
    const content = prev[idx].content;
    const trimmed = prev.slice(0, idx);
    messagesRef.current = trimmed;
    setMessages(trimmed);
    send(content);
  }, [send]);

  return {
    messages,
    followUps,
    error,
    status,
    busy: status === 'loading',
    send,
    retry,
  };
}

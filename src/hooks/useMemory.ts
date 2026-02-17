import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_API = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';

export type MemoryItem = {
  id?: string;
  title?: string;
  content: string;
  source?: string;
};

export default function useMemory(apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API).replace(/\/+$/, '');
  const esRef = useRef<EventSource | null>(null);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsert = useCallback(async (userId: string, newItems: MemoryItem[]) => {
    // optimistic update: add to local cache immediately
    const optimistic = newItems.map((it) => ({ ...it, id: it.id || `local-${Date.now()}-${Math.random()}` }));
    setItems((cur) => [...optimistic, ...cur]);

    const url = `${base}/memory/upsert`;
    try {
      setLoading(true);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, items: newItems }),
      });
      const json = await res.json();
      setLoading(false);
      if (!json || !json.success) {
        setError(json?.error || 'upsert failed');
        return json;
      }
      // no reliable ids returned — keep optimistic cache as-is
      return json;
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || String(err));
      console.warn('memory.upsert failed', err);
      return { success: false, error: err?.message };
    }
  }, [base]);

  const search = useCallback(async (userId: string, query: string, top_k = 5) => {
    const url = `${base}/memory/search?user_id=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}&top_k=${top_k}`;
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.warn('memory.search failed', err);
      throw err;
    }
  }, [base]);

  const subscribe = useCallback((userId: string, onEvent?: (data: any) => void) => {
    if (typeof EventSource === 'undefined') {
      console.warn('EventSource not available in this environment — SSE unsupported');
      return () => {};
    }
    const url = `${base.replace(/\/api\/v1$/, '')}/api/v1/stream/memory?user_id=${encodeURIComponent(userId)}`;
    try {
      const es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const data = ev.data ? JSON.parse(ev.data) : null;
          // update local cache immutably on upsert events
          if (data && data.type === 'upsert' && data.count) {
            // simple indicator — caller can fetch if needed
            onEvent && onEvent(data);
          } else {
            onEvent && onEvent(data);
          }
        } catch (e) {
          onEvent && onEvent(ev.data);
        }
      };
      es.onerror = (e) => {
        console.warn('SSE error', e);
      };
      esRef.current = es;
      return () => {
        try { es.close(); } catch (_) {}
        esRef.current = null;
      };
    } catch (err) {
      console.warn('Failed to subscribe SSE', err);
      return () => {};
    }
  }, [base]);

  useEffect(() => {
    return () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch (_) {}
        esRef.current = null;
      }
    };
  }, []);

  return { items, loading, error, upsert, search, subscribe };
}

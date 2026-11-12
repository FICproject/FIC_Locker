import { useEffect, useRef } from 'react';
import { apiClient, tokenStorage } from '../lib/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function useAdminLiveSync(onSync: () => void, enabled = true) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let lastSeq: number | null = null;
    let debounceTimer: number | null = null;
    let pollTimer: number | null = null;
    let abortCtrl: AbortController | null = null;

    const triggerSync = () => {
      if (cancelled) return;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!cancelled) onSyncRef.current();
      }, 200);
    };

    const pollVersion = async () => {
      try {
        const res = await apiClient.get<{ data: { seq: number } }>('/admin/events/version');
        const nextSeq = res.data?.data?.seq ?? 0;
        if (lastSeq !== null && nextSeq > lastSeq) {
          triggerSync();
        }
        lastSeq = nextSeq;
      } catch {
        // Ignore transient network errors during background sync
      }
    };

    const connectSse = async () => {
      const token = tokenStorage.getAccessToken();
      if (!token || cancelled) return;

      abortCtrl = new AbortController();
      try {
        const response = await fetch(`${API_BASE_URL}/admin/events/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
            'X-Client-Platform': 'admin-web',
          },
          signal: abortCtrl.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('SSE unavailable');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(5).trim()) as { seq?: number };
              if (typeof payload.seq === 'number') {
                if (lastSeq !== null && payload.seq > lastSeq) {
                  triggerSync();
                }
                lastSeq = payload.seq;
              }
            } catch {
              // Ignore keep-alive or malformed lines
            }
          }
        }
      } catch {
        // Fallback polling continues below
      }
    };

    connectSse();
    pollTimer = window.setInterval(pollVersion, 4000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      abortCtrl?.abort();
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [enabled]);
}

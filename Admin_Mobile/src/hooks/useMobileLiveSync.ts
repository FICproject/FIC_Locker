import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { mobileApiClient } from '../services/apiClient';

export function useMobileLiveSync(onSync: () => void, enabled = true) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const lastSeqRef = useRef<number | null>(null);
  const hasFocusedOnceRef = useRef(false);

  const checkVersion = useCallback(async () => {
    try {
      const res = await mobileApiClient.get<{ data: { seq: number } }>('/admin/events/version');
      const nextSeq = res.data?.data?.seq ?? 0;
      if (lastSeqRef.current !== null && nextSeq > lastSeqRef.current) {
        onSyncRef.current();
      }
      lastSeqRef.current = nextSeq;
    } catch {
      // Ignore transient offline/background errors
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;

      // Skip redundant fetch on initial mount (screen useEffect loads initial state);
      // refresh immediately whenever returning to or switching back to this screen.
      if (hasFocusedOnceRef.current) {
        onSyncRef.current();
      } else {
        hasFocusedOnceRef.current = true;
      }
      checkVersion();

      const timer = setInterval(checkVersion, 2500);
      return () => {
        clearInterval(timer);
      };
    }, [enabled, checkVersion])
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        onSyncRef.current();
        checkVersion();
      }
    });
    return () => sub.remove();
  }, [enabled, checkVersion]);
}

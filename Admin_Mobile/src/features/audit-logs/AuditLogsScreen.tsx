import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { AuditLogRecord } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

export function AuditLogsScreen() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [sourceApp, setSourceApp] = useState<'all' | 'admin-mobile' | 'admin-web'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);
      try {
        setLogs(await adminMobileApi.auditLogs.list(sourceApp === 'all' ? undefined : sourceApp));
      } catch (err) {
        if (mode !== 'silent') setError(getErrorMessage(err));
      } finally {
        if (mode !== 'silent') {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [sourceApp]
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  useMobileLiveSync(() => {
    load('silent');
  });

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        {(['all', 'admin-mobile', 'admin-web'] as const).map((src) => (
          <TouchableOpacity
            key={src}
            style={[styles.chip, sourceApp === src && styles.chipActive]}
            onPress={() => setSourceApp(src)}
          >
            <Text style={[styles.chipText, sourceApp === src && styles.chipTextActive]}>{src}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading ? (
        <LoadingView label="Loading audit trail..." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No audit logs found" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.action}>{item.action}</Text>
                <StatusPill status={item.sourceApp} />
              </View>
              <Text style={styles.summary}>{item.summary}</Text>
              <Text style={styles.sub}>
                {item.entityType} • {formatDateTime(item.createdAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  chips: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#4F46E5' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF' },
  list: { padding: 14, gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  summary: { fontSize: 13, color: '#0F172A' },
  sub: { fontSize: 11, color: '#94A3B8' },
});

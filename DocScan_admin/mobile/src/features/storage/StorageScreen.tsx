import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { StorageOverview } from '../../types/admin';
import { formatBytes, formatDateTime } from '../../utils/format';
import { EmptyView, ErrorView, KpiTile, LoadingView, StatusPill } from '../../components/MobilePrimitives';

export function StorageScreen() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await adminMobileApi.monitoring.storage());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <LoadingView label="Loading storage telemetry..." />;
  if (error && !data) return <ErrorView message={error} onRetry={() => load()} />;
  if (!data) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View style={styles.grid}>
        <KpiTile label="Total Capacity" value={formatBytes(data.totalCapacityBytes)} />
        <KpiTile label="Storage Used" value={formatBytes(data.totalUsedBytes)} sub={`${data.utilizationPercent}%`} />
        <KpiTile label="Available" value={formatBytes(data.totalAvailableBytes)} />
        <KpiTile label="Exceptions" value={data.uploadExceptions.length} />
      </View>

      <Text style={styles.sectionTitle}>Plan-wise Storage</Text>
      <View style={styles.card}>
        {data.planWiseUsage.map((p) => (
          <View key={p.planName} style={styles.row}>
            <Text style={styles.planName}>{p.planName} ({p.userCount} users)</Text>
            <Text style={styles.planVal}>{formatBytes(p.usedBytes)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Upload Failures & Storage Exceptions</Text>
      {data.uploadExceptions.length === 0 ? (
        <EmptyView title="No upload failures" />
      ) : (
        data.uploadExceptions.map((ex) => (
          <View key={ex._id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.planName}>{ex.fileName || 'Unknown'}</Text>
              <StatusPill status="failed" />
            </View>
            <Text style={styles.meta}>{ex.userEmail || ex.userId}</Text>
            <Text style={styles.errText}>{ex.failureMessage}</Text>
            <Text style={styles.sub}>{formatDateTime(ex.createdAt)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginTop: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  planVal: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
  meta: { fontSize: 12, color: '#475569' },
  errText: { fontSize: 12, color: '#B91C1C' },
  sub: { fontSize: 11, color: '#94A3B8' },
});

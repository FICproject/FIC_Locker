import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function StatusPill({ status }: { status?: string | null }) {
  const s = (status || 'unknown').toLowerCase();
  const palette: Record<string, { bg: string; fg: string }> = {
    active: { bg: '#DCFCE7', fg: '#166534' },
    available: { bg: '#DCFCE7', fg: '#166534' },
    captured: { bg: '#DCFCE7', fg: '#166534' },
    resolved: { bg: '#DCFCE7', fg: '#166534' },
    sent: { bg: '#DCFCE7', fg: '#166534' },
    open: { bg: '#E0F2FE', fg: '#0369A1' },
    in_progress: { bg: '#DBEAFE', fg: '#1D4ED8' },
    pending: { bg: '#FEF3C7', fg: '#92400E' },
    high: { bg: '#FFEDD5', fg: '#C2410C' },
    urgent: { bg: '#FEE2E2', fg: '#B91C1C' },
    suspended: { bg: '#FEE2E2', fg: '#B91C1C' },
    failed: { bg: '#FEE2E2', fg: '#B91C1C' },
    expired: { bg: '#FEE2E2', fg: '#B91C1C' },
    refunded: { bg: '#F3E8FF', fg: '#7E22CE' },
  };
  const colors = palette[s] || { bg: '#F1F5F9', fg: '#334155' };

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.pillText, { color: colors.fg }]}>{s.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function KpiTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{String(value)}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

export function LoadingView({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4F46E5" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyView({ title }: { title: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.mutedText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  kpiTile: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' },
  kpiValue: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  kpiSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  mutedText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  errorCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 10,
  },
  errorText: { fontSize: 13, color: '#991B1B' },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  retryBtnText: { fontSize: 12, fontWeight: '600', color: '#991B1B' },
  emptyCard: {
    padding: 28,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
});

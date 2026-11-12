import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { DashboardPayload } from '../../types/admin';
import type { MainTabParamList } from '../../navigation/types';
import { formatBytes, formatInr, formatRelativeTime } from '../../utils/format';
import { ErrorView, LoadingView } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);
    if (mode !== 'silent') setError(null);
    try {
      const payload = await adminMobileApi.dashboard.getOverview();
      setData(payload);
    } catch (err) {
      if (mode !== 'silent') setError(getErrorMessage(err));
    } finally {
      if (mode !== 'silent') {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load('initial');
  }, [load]);

  useMobileLiveSync(() => {
    load('silent');
  });

  if (loading && !data) return <LoadingView label="Loading platform overview..." />;
  if (error && !data) return <ErrorView message={error} onRetry={() => load()} />;
  if (!data) return null;

  const { kpis, alerts, recentActivities } = data;
  const totalAlerts =
    alerts.failedUploads + alerts.openTicketsCount + alerts.pendingDeletionsCount + alerts.pendingRecoveriesCount;

  return (
    <View style={styles.root}>
      {/* Custom Top Header matching DocScan Cloud UI */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('MoreTab')} style={styles.headerBtn}>
          <Text style={styles.menuGlyph}>☰</Text>
        </TouchableOpacity>

        <View style={styles.brandCenter}>
          <Text style={styles.brandCloud}>☁</Text>
          <Text style={styles.brandTitle}>FIC Locker</Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('MoreTab', { screen: 'Notifications' } as never)}
          style={styles.headerBtn}
        >
          <Text style={styles.bellGlyph}>🔔</Text>
          {totalAlerts > 0 ? (
            <View style={styles.badgeCircle}>
              <Text style={styles.badgeText}>{totalAlerts > 9 ? '9+' : totalAlerts}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      >
        {/* Welcome Banner Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeTextWrap}>
            <Text style={styles.welcomeTitle}>Welcome, Admin!</Text>
            <Text style={styles.welcomeSub}>Platform at a glance</Text>
          </View>
          <View style={styles.welcomeBadge}>
            <Text style={styles.welcomeCloudIcon}>☁↑</Text>
          </View>
        </View>

        {/* 2x2 Pastel KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: '#EAF3FF', borderColor: '#DBEAFE' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#CFE2FF' }]}>
              <Text style={[styles.kpiIconText, { color: '#1D63DC' }]}>👥</Text>
            </View>
            <Text style={styles.kpiVal}>{kpis.totalUsers.toLocaleString('en-IN')}</Text>
            <Text style={styles.kpiLbl}>Users</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#CBEFD9' }]}>
              <Text style={[styles.kpiIconText, { color: '#059669' }]}>📄</Text>
            </View>
            <Text style={styles.kpiVal}>{kpis.totalDocuments.toLocaleString('en-IN')}</Text>
            <Text style={styles.kpiLbl}>Documents</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#FFF7E8', borderColor: '#FDE68A' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FDE2B8' }]}>
              <Text style={[styles.kpiIconText, { color: '#D97706' }]}>💾</Text>
            </View>
            <Text style={styles.kpiVal}>{formatBytes(kpis.totalStorageUsedBytes)}</Text>
            <Text style={styles.kpiLbl}>Storage</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#F4EEFF', borderColor: '#E9D5FF' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#E2D4FC' }]}>
              <Text style={[styles.kpiIconText, { color: '#7C3AED' }]}>₹</Text>
            </View>
            <Text style={styles.kpiVal}>{formatInr(kpis.totalRevenueInr)}</Text>
            <Text style={styles.kpiLbl}>Revenue</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MoreTab')}>
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('UsersTab')}>
            <View style={[styles.quickIconBox, { backgroundColor: '#EAF3FF' }]}>
              <Text style={{ fontSize: 18 }}>👤</Text>
            </View>
            <Text style={styles.quickLabel}>Manage{'\n'}Users</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('DocumentsTab')}>
            <View style={[styles.quickIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 18 }}>📁</Text>
            </View>
            <Text style={styles.quickLabel}>View{'\n'}Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate('MoreTab', { screen: 'StorageMonitoring' } as never)}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#FFF7E8' }]}>
              <Text style={{ fontSize: 18 }}>📊</Text>
            </View>
            <Text style={styles.quickLabel}>Storage &{'\n'}Status</Text>
          </TouchableOpacity>
        </View>

        {/* Operational Status Strip */}
        <View style={styles.statusStrip}>
          <Text style={styles.statusChip}>Active: {kpis.activeUsers}</Text>
          <Text style={styles.statusChip}>Failed Uploads: {kpis.failedUploads}</Text>
          <Text style={styles.statusChip}>Open Tickets: {alerts.openTicketsCount}</Text>
        </View>

        {/* Recent Activities */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('MoreTab', { screen: 'AuditLogs' } as never)}
          >
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityCard}>
          {recentActivities.length === 0 ? (
            <Text style={styles.muted}>No audit activities recorded yet.</Text>
          ) : (
            recentActivities.slice(0, 5).map((a) => (
              <View key={a._id} style={styles.activityRow}>
                <View style={styles.activityIconCircle}>
                  <Text style={{ fontSize: 14 }}>
                    {a.entityType === 'document' ? '⬆' : a.entityType === 'payment' ? '💳' : '🛡'}
                  </Text>
                </View>
                <View style={styles.activityBody}>
                  <Text style={styles.activitySummary} numberOfLines={2}>
                    {a.summary}
                  </Text>
                  <Text style={styles.activityTime}>
                    {formatRelativeTime(a.createdAt)} • {a.sourceApp}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F7FD' },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { padding: 6, position: 'relative' },
  menuGlyph: { fontSize: 20, color: '#0F172A', fontWeight: '700' },
  brandCenter: { alignItems: 'center' },
  brandCloud: { fontSize: 20, color: '#1D63DC', lineHeight: 22 },
  brandTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  bellGlyph: { fontSize: 18 },
  badgeCircle: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1D63DC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  screen: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeTextWrap: { flex: 1 },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  welcomeSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  welcomeBadge: {
    width: 54,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1D63DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCloudIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  kpiIconText: { fontSize: 16, fontWeight: '800' },
  kpiVal: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  kpiLbl: { fontSize: 12, fontWeight: '600', color: '#475569' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  viewAll: { fontSize: 12, fontWeight: '700', color: '#1D63DC' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  quickIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  statusStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statusChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activityCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  muted: { fontSize: 13, color: '#64748B' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activityIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: { flex: 1 },
  activitySummary: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  activityTime: { fontSize: 11, color: '#64748B', marginTop: 2 },
});

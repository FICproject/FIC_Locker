import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { PaymentRecord, PlanRecord, SubscriptionRecord } from '../../types/admin';
import { formatBytes, formatDateTime, formatInr } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

export function SubscriptionsPaymentsScreen() {
  const [tab, setTab] = useState<'plans' | 'subscriptions' | 'payments'>('plans');
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [subs, setSubs] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);
      try {
        if (tab === 'plans') {
          setPlans(await adminMobileApi.plans.list());
        } else if (tab === 'subscriptions') {
          setSubs(await adminMobileApi.monitoring.subscriptions());
        } else {
          setPayments(await adminMobileApi.monitoring.payments());
        }
      } catch (err) {
        if (mode !== 'silent') setError(getErrorMessage(err));
      } finally {
        if (mode !== 'silent') {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [tab]
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  useMobileLiveSync(() => {
    load('silent');
  });

  const handleTogglePlanStatus = async (plan: PlanRecord) => {
    try {
      await adminMobileApi.plans.toggleStatus(plan._id, !plan.isActive);
      load('refresh');
    } catch (err) {
      Alert.alert('Status Update Failed', getErrorMessage(err));
    }
  };

  const handleDeletePlan = (plan: PlanRecord) => {
    Alert.alert(
      'Delete Plan',
      `Are you sure you want to permanently delete "${plan.name}"?\n\nThis will remove the plan across both the Admin Mobile App and Admin Website.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminMobileApi.plans.delete(plan._id);
              load('refresh');
            } catch (err) {
              Alert.alert('Cannot Delete Plan', getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'plans' && styles.tabActive]}
          onPress={() => setTab('plans')}
        >
          <Text style={[styles.tabText, tab === 'plans' && styles.tabTextActive]}>Plans</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'subscriptions' && styles.tabActive]}
          onPress={() => setTab('subscriptions')}
        >
          <Text style={[styles.tabText, tab === 'subscriptions' && styles.tabTextActive]}>Subscriptions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'payments' && styles.tabActive]}
          onPress={() => setTab('payments')}
        >
          <Text style={[styles.tabText, tab === 'payments' && styles.tabTextActive]}>Payments</Text>
        </TouchableOpacity>
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading ? (
        <LoadingView />
      ) : tab === 'plans' ? (
        <FlatList
          data={plans}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No subscription plans configured" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.title}>{item.name}</Text>
                  <Text style={styles.metaCode}>{item.code.toUpperCase()}</Text>
                </View>
                <StatusPill status={item.isActive ? 'active' : 'suspended'} />
              </View>

              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}

              <View style={styles.planStats}>
                <View style={styles.planStatCol}>
                  <Text style={styles.planStatLabel}>Monthly</Text>
                  <Text style={styles.planStatVal}>{formatInr(item.monthlyPriceInr)}</Text>
                </View>
                <View style={styles.planStatCol}>
                  <Text style={styles.planStatLabel}>Annual</Text>
                  <Text style={styles.planStatVal}>{formatInr(item.annualPriceInr)}</Text>
                </View>
                <View style={styles.planStatCol}>
                  <Text style={styles.planStatLabel}>Storage</Text>
                  <Text style={styles.planStatVal}>{formatBytes(item.storageLimitBytes)}</Text>
                </View>
              </View>

              <Text style={styles.sub}>
                Max upload: {formatBytes(item.maxFileSizeBytes)} • Docs: {item.documentLimit ?? 'Unlimited'}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, item.isActive ? styles.btnDeactivate : styles.btnActivate]}
                  onPress={() => handleTogglePlanStatus(item)}
                >
                  <Text style={[styles.actionBtnText, item.isActive ? styles.textDeactivate : styles.textActivate]}>
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnDelete]}
                  onPress={() => handleDeletePlan(item)}
                >
                  <Text style={[styles.actionBtnText, styles.textDelete]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : tab === 'subscriptions' ? (
        <FlatList
          data={subs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No subscriptions found" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.planName} ({item.billingCycle})</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.meta}>{item.userEmail || item.userId}</Text>
              <Text style={styles.sub}>Auto-renew: {item.autoRenew ? 'Yes' : 'No'}</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No payment transactions found" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{formatInr(item.amountInr)}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.meta}>{item.userEmail || 'User'} • {item.method || 'razorpay'}</Text>
              <Text style={styles.sub}>
                {item.providerPaymentId || item._id} • {formatDateTime(item.createdAt)}
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
  tabs: { flexDirection: 'row', margin: 14, backgroundColor: '#E2E8F0', borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#0F172A' },
  list: { paddingHorizontal: 14, paddingBottom: 20, gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#475569' },
  desc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  metaCode: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  sub: { fontSize: 11, color: '#94A3B8' },
  planStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
  },
  planStatCol: { alignItems: 'center', flex: 1 },
  planStatLabel: { fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: '600' },
  planStatVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 1 },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnActivate: { backgroundColor: '#DCFCE7' },
  textActivate: { color: '#166534' },
  btnDeactivate: { backgroundColor: '#FEF3C7' },
  textDeactivate: { color: '#92400E' },
  btnDelete: { backgroundColor: '#FEE2E2' },
  textDelete: { color: '#B91C1C' },
});

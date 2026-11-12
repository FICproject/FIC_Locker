import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { PaymentRecord, SubscriptionRecord } from '../../types/admin';
import { formatDateTime, formatInr } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';

export function SubscriptionsPaymentsScreen() {
  const [tab, setTab] = useState<'subscriptions' | 'payments'>('subscriptions');
  const [subs, setSubs] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        if (tab === 'subscriptions') {
          setSubs(await adminMobileApi.monitoring.subscriptions());
        } else {
          setPayments(await adminMobileApi.monitoring.payments());
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
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
      ) : tab === 'subscriptions' ? (
        <FlatList
          data={subs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
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
  sub: { fontSize: 11, color: '#94A3B8' },
});

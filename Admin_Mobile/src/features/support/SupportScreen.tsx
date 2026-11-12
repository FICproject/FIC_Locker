import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { SupportTicketRecord } from '../../types/admin';
import type { SupportStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

type Props = NativeStackScreenProps<SupportStackParamList, 'SupportList'>;

export function SupportScreen({ navigation }: Props) {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [status, setStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);
      try {
        const list = await adminMobileApi.support.list({
          status: status === 'all' ? undefined : status,
        });
        setTickets(list);
      } catch (err) {
        if (mode !== 'silent') setError(getErrorMessage(err));
      } finally {
        if (mode !== 'silent') {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [status]
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  useMobileLiveSync(() => {
    load('silent');
  });

  return (
    <View style={styles.screen}>
      <View style={styles.filterBar}>
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading && tickets.length === 0 ? (
        <LoadingView label="Loading support tickets..." />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No support tickets found" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('TicketDetail', { ticketId: item._id })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.ticketNum}>{item.ticketNumber}</Text>
                <View style={styles.badges}>
                  <StatusPill status={item.priority} />
                  <StatusPill status={item.status} />
                </View>
              </View>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.meta}>
                {item.userEmail || item.userId} • {formatDateTime(item.updatedAt)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#4F46E5' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  chipTextActive: { color: '#FFFFFF' },
  listContent: { padding: 14, gap: 10 },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 6 },
  ticketNum: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  subject: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B' },
});

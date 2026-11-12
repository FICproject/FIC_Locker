import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { AdminUserSummary } from '../../types/admin';
import type { UsersStackParamList } from '../../navigation/types';
import { formatBytes } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

type Props = NativeStackScreenProps<UsersStackParamList, 'UsersList'>;

export function UsersScreen({ navigation }: Props) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);
      try {
        const list = await adminMobileApi.users.list({
          search: search.trim() || undefined,
          status: status === 'all' ? undefined : status,
        });
        setUsers(list);
      } catch (err) {
        if (mode !== 'silent') setError(getErrorMessage(err));
      } finally {
        if (mode !== 'silent') {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [search, status]
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search user name, email, or phone..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load()}
          returnKeyType="search"
        />
        <View style={styles.chips}>
          {(['all', 'active', 'suspended'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading && users.length === 0 ? (
        <LoadingView label="Loading users..." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No matching users found" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('UserDetail', { userId: item._id })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{item.fullName}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.meta}>
                {item.planName || 'Free'} • {item.totalDocuments} docs • {formatBytes(item.storageUsedBytes)}
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
  filterBar: { padding: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 10 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#4F46E5' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  chipTextActive: { color: '#FFFFFF' },
  listContent: { padding: 14, gap: 10 },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  email: { fontSize: 13, color: '#64748B' },
  meta: { fontSize: 12, color: '#475569', marginTop: 2 },
});

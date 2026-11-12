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
import type { AdminDocumentRecord, UploadExceptionRecord } from '../../types/admin';
import type { DocumentsStackParamList } from '../../navigation/types';
import { formatBytes, formatDateTime } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';

type Props = NativeStackScreenProps<DocumentsStackParamList, 'DocumentsList'>;

export function DocumentsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'all' | 'failed'>('all');
  const [docs, setDocs] = useState<AdminDocumentRecord[]>([]);
  const [failed, setFailed] = useState<UploadExceptionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        if (tab === 'all') {
          const list = await adminMobileApi.documents.list({ search: search.trim() || undefined });
          setDocs(list);
        } else {
          const list = await adminMobileApi.documents.failedUploads();
          setFailed(list);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, search]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]}
            onPress={() => setTab('all')}
          >
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>Documents</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'failed' && styles.tabBtnActive]}
            onPress={() => setTab('failed')}
          >
            <Text style={[styles.tabText, tab === 'failed' && styles.tabTextActive]}>Failed Uploads</Text>
          </TouchableOpacity>
        </View>
        {tab === 'all' ? (
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load()}
          />
        ) : null}
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading ? (
        <LoadingView />
      ) : tab === 'all' ? (
        <FlatList
          data={docs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={<EmptyView title="No documents found" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DocumentDetail', { documentId: item._id })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.name}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.meta}>
                {item.ownerEmail || item.ownerId} • {item.categoryName || 'Uncategorised'}
              </Text>
              <Text style={styles.sub}>
                {formatBytes(item.totalSizeBytes)} • {formatDateTime(item.createdAt)}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={failed}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={<EmptyView title="No failed uploads recorded" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.fileName || 'Unnamed File'}</Text>
                <StatusPill status="failed" />
              </View>
              <Text style={styles.meta}>{item.userEmail || item.userId}</Text>
              <Text style={styles.errorLine}>{item.failureMessage}</Text>
              <Text style={styles.sub}>{formatDateTime(item.createdAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: { padding: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 10 },
  tabs: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#0F172A' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  listContent: { padding: 14, gap: 10 },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
  meta: { fontSize: 12, color: '#475569' },
  sub: { fontSize: 11, color: '#94A3B8' },
  errorLine: { fontSize: 12, color: '#B91C1C' },
});

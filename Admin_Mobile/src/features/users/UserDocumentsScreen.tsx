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
import type { AdminDocumentRecord } from '../../types/admin';
import type { UsersStackParamList } from '../../navigation/types';
import { formatBytes, formatDateTime } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

type Props = NativeStackScreenProps<UsersStackParamList, 'UserDocuments'>;

export function UserDocumentsScreen({ route, navigation }: Props) {
  const { userId, userName } = route.params;
  const [docs, setDocs] = useState<AdminDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);
      if (mode !== 'silent') setError(null);
      try {
        const list = await adminMobileApi.documents.list({ userId });
        setDocs(list);
      } catch (err) {
        if (mode !== 'silent') setError(getErrorMessage(err));
      } finally {
        if (mode !== 'silent') {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  useMobileLiveSync(() => {
    load('silent');
  });

  return (
    <View style={styles.screen}>
      <View style={styles.headerBanner}>
        <Text style={styles.headerTitle}>Documents for {userName}</Text>
        <Text style={styles.headerSub}>
          {docs.length} document{docs.length === 1 ? '' : 's'} found in user vault
        </Text>
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading && docs.length === 0 ? (
        <LoadingView label="Loading user documents..." />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={
            <EmptyView
              title="No documents uploaded for this user"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DocumentDetail', { documentId: item._id })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.docName} numberOfLines={1}>
                  📄 {item.name}
                </Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.category}>Category: {item.categoryName || 'General'}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{formatBytes(item.totalSizeBytes)}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{formatDateTime(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  headerBanner: {
    padding: 14,
    backgroundColor: '#EEF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#0A3A8E' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  listContent: { padding: 14, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docName: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
  category: { fontSize: 12, color: '#475569' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 11, color: '#64748B' },
  metaDot: { marginHorizontal: 6, color: '#94A3B8' },
});

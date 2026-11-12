import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { NotificationBroadcastRecord } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { EmptyView, ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

export function NotificationsScreen() {
  const [items, setItems] = useState<NotificationBroadcastRecord[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'both' | 'push' | 'in_app'>('both');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);
    if (mode !== 'silent') setError(null);
    try {
      setItems(await adminMobileApi.notifications.list());
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

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Validation', 'Please provide both title and message.');
      return;
    }
    setSending(true);
    try {
      await adminMobileApi.notifications.sendAnnouncement(title.trim(), body.trim(), channel);
      setTitle('');
      setBody('');
      Alert.alert('Sent', 'Announcement dispatched to all active users.');
      await load();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.composeCard}>
        <Text style={styles.sectionTitle}>Send Service Announcement (All Users)</Text>
        <TextInput style={styles.input} placeholder="Notification title" value={title} onChangeText={setTitle} />
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          multiline
          placeholder="Message..."
          value={body}
          onChangeText={setBody}
        />
        <View style={styles.chips}>
          {(['both', 'push', 'in_app'] as const).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, channel === c && styles.chipActive]}
              onPress={() => setChannel(c)}
            >
              <Text style={[styles.chipText, channel === c && styles.chipTextActive]}>{c.replace('_', ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.btn} disabled={sending} onPress={handleSend}>
          <Text style={styles.btnText}>{sending ? 'Sending...' : 'Send Notification'}</Text>
        </TouchableOpacity>
      </View>

      {error ? <ErrorView message={error} onRetry={() => load()} /> : null}

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          ListEmptyComponent={<EmptyView title="No notification history" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{item.title}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.sub}>
                {item.channel} • {item.recipientCount} recipients • {formatDateTime(item.sentAt || item.createdAt)}
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
  composeCard: {
    margin: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, fontSize: 13 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#4F46E5' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569', textTransform: 'uppercase' },
  chipTextActive: { color: '#FFFFFF' },
  btn: { backgroundColor: '#4F46E5', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: 14, paddingBottom: 20, gap: 10 },
  card: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
  body: { fontSize: 13, color: '#334155' },
  sub: { fontSize: 11, color: '#94A3B8' },
});

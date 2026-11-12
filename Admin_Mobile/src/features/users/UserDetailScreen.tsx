import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { AdminUserDetail } from '../../types/admin';
import type { UsersStackParamList } from '../../navigation/types';
import { formatBytes, formatDateTime } from '../../utils/format';
import { ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

type Props = NativeStackScreenProps<UsersStackParamList, 'UserDetail'>;

export function UserDetailScreen({ route }: Props) {
  const { userId } = route.params;
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      try {
        const detail = await adminMobileApi.users.getById(userId);
        setUser(detail);
      } catch (err) {
        if (!silent) setError(getErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useMobileLiveSync(() => {
    load(true);
  });

  const handleToggleStatus = async (nextStatus: 'active' | 'suspended') => {
    setBusy(true);
    try {
      await adminMobileApi.users.updateStatus(userId, nextStatus, reason.trim() || undefined);
      Alert.alert('Updated', `User account ${nextStatus === 'active' ? 'activated' : 'suspended'}.`);
      setReason('');
      await load();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingView label="Loading user profile..." />;
  if (error) return <ErrorView message={error} onRetry={() => load(false)} />;
  if (!user) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{user.fullName}</Text>
          <StatusPill status={user.status} />
        </View>
        <Text style={styles.sub}>{user.email}</Text>
        {user.phone ? <Text style={styles.sub}>{user.phone}</Text> : null}

        <View style={styles.divider} />
        <Text style={styles.row}>Registered: {formatDateTime(user.registrationDate)}</Text>
        <Text style={styles.row}>Storage Used: {formatBytes(user.storageUsedBytes)}</Text>
        <Text style={styles.row}>Total Documents: {user.totalDocuments}</Text>
        <Text style={styles.row}>
          Subscription: {user.subscription?.planName || user.planName || 'Free'}{' '}
          {user.subscription ? `(${user.subscription.status})` : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Status Action</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional audit reason..."
          value={reason}
          onChangeText={setReason}
        />
        {user.status === 'active' ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger]}
            disabled={busy}
            onPress={() => handleToggleStatus('suspended')}
          >
            <Text style={styles.btnText}>{busy ? 'Updating...' : 'Suspend User'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnSuccess]}
            disabled={busy}
            onPress={() => handleToggleStatus('active')}
          >
            <Text style={styles.btnText}>{busy ? 'Updating...' : 'Activate / Reactivate User'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  row: { fontSize: 13, color: '#334155' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 8 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnDanger: { backgroundColor: '#DC2626' },
  btnSuccess: { backgroundColor: '#059669' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMobileAuth } from '../../app/AuthContext';
import type { MoreStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHub'>;

export function MoreScreen({ navigation }: Props) {
  const { admin, logout } = useMobileAuth();

  const items: Array<{ title: string; subtitle: string; screen: keyof MoreStackParamList }> = [
    {
      title: 'Subscriptions & Payments',
      subtitle: 'Monitor active plans, renewals, and Razorpay statuses',
      screen: 'SubscriptionsPayments',
    },
    {
      title: 'Storage Usage & Exceptions',
      subtitle: 'Monitor cloud capacity, plan usage, and upload failures',
      screen: 'StorageMonitoring',
    },
    {
      title: 'Notifications',
      subtitle: 'Send service announcements and view history',
      screen: 'Notifications',
    },
    {
      title: 'Admin Activity Audit Trail',
      subtitle: 'Inspect privileged operations across Web & Mobile',
      screen: 'AuditLogs',
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <Text style={styles.profileName}>{admin?.name || 'Platform Admin'}</Text>
        <Text style={styles.profileEmail}>{admin?.email}</Text>
        <Text style={styles.profileBadge}>Single Platform Admin Mode</Text>
      </View>

      <View style={styles.menuCard}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.menuRow}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSub}>{item.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 16 },
  profileCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 18, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  profileEmail: { fontSize: 13, color: '#CBD5E1' },
  profileBadge: { fontSize: 11, color: '#818CF8', fontWeight: '700', marginTop: 4 },
  menuCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  menuSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  chevron: { fontSize: 22, color: '#94A3B8', paddingLeft: 10 },
  logoutBtn: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#B91C1C', fontWeight: '700', fontSize: 15 },
});

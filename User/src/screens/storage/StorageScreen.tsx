import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { formatBytes } from '../../utils/formatters';

export const StorageScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const totalQuota = 1073741824; // 1 GB
  const used = 256901120; // 245 MB
  const percent = Math.round((used / totalQuota) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Storage Management</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.storageCard}>
        <Text style={styles.planBadge}>Current Plan: Free Starter</Text>
        <Text style={styles.storageValue}>
          {formatBytes(used)} <Text style={styles.quotaValue}>/ {formatBytes(totalQuota)}</Text>
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>

        <Text style={styles.statSub}>{percent}% of cloud storage used</Text>
      </View>

      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Storage Breakdown</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>📄 PDF Documents</Text>
          <Text style={styles.rowValue}>182 MB</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>🖼️ Image Scans</Text>
          <Text style={styles.rowValue}>63 MB</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>⚠️ Failed Uploads</Text>
          <Text style={styles.rowValue}>0 B</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.upgradeBtn}
        onPress={() => navigation.navigate('Subscription')}
        activeOpacity={0.85}
      >
        <Text style={styles.upgradeBtnText}>Upgrade Storage Quota</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    padding: 6,
  },
  backText: {
    fontSize: 22,
    color: colors.text,
  },
  title: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  storageCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: borderRadius.xl,
    ...shadows.card,
    marginBottom: 20,
  },
  planBadge: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  storageValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  quotaValue: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: 'normal',
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    marginVertical: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  statSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: borderRadius.xl,
    ...shadows.card,
    marginBottom: 24,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.text,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  upgradeBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});


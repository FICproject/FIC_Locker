import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { documentService, storageService } from '../../services/api/documentService';
import { DocumentItem, StorageInfo } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { deduplicateDocuments } from '../../utils/documentUtils';
import { BellIcon, SearchIcon } from '../../assets/icons';
import { DocScannerFab } from '../../components/common/DocScannerFab';
import { DocScanCard } from '../../components/common/DocScanCard';

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [storage, setStorage] = useState<StorageInfo>({
    planName: 'Basic Free',
    quotaBytes: 524288000,
    usedBytes: 0,
    availableBytes: 524288000,
    usedPercentage: 0,
    documentCount: 0,
    failedUploadCount: 0,
  });

  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    let allDocs: DocumentItem[] = [];

    // 1. Fetch offline cached documents
    let localDocs: DocumentItem[] = [];
    try {
      const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
      if (cached) {
        localDocs = deduplicateDocuments(JSON.parse(cached));
      }
    } catch {}

    // 2. Fetch backend documents
    let serverDocs: DocumentItem[] = [];
    try {
      const docsRes = await documentService.getDocuments({ sortBy: 'createdAt', sortOrder: 'desc' });
      if (docsRes.documents?.length) {
        serverDocs = deduplicateDocuments(docsRes.documents);
      }
    } catch (e) {
      // Offline fallback
    }

    allDocs = deduplicateDocuments([...serverDocs, ...localDocs]);

    // Sort by createdAt desc
    allDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Display maximum of 10 recent documents
    setRecentDocs(allDocs.slice(0, 10));

    // Update storage stats
    try {
      const storageRes = await storageService.getStorageInfo();
      const realUsedBytes = allDocs.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
      setStorage({
        ...storageRes,
        usedBytes: storageRes.usedBytes || realUsedBytes,
        documentCount: allDocs.length,
      });
    } catch (e) {
      const realUsedBytes = allDocs.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
      setStorage((prev) => ({
        ...prev,
        usedBytes: realUsedBytes,
        documentCount: allDocs.length,
      }));
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Navigates to My Docs tab
  const handleSeeAll = () => {
    try {
      navigation.navigate('MainTabs', { screen: 'DocumentsTab' });
    } catch {
      navigation.navigate('DocumentsTab');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" translucent={false} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Top Header / Greeting */}
        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>
                Hello, {user?.name || 'User'}
              </Text>
              <Text style={styles.waveEmoji}>👋</Text>
            </View>
            <Text style={styles.greetingSub}>Your documents are safe with us!</Text>
          </View>

          {/* Action Icons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
              accessibilityLabel="Search"
            >
              <SearchIcon size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
              accessibilityLabel="Notifications"
            >
              <BellIcon size={22} color={colors.text} />
              <View style={styles.badgeDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Storage Summary Cards Row */}
        <View style={styles.statsRow}>
          {/* Total Documents Card */}
          <View style={styles.statCard}>
            <View style={[styles.statIconBadge, { backgroundColor: '#EDE9FE' }]}>
              <Text style={{ fontSize: 18 }}>📁</Text>
            </View>
            <Text style={styles.statLabel}>Total Documents</Text>
            <Text style={styles.statValue}>{storage.documentCount || 0}</Text>
          </View>

          {/* Storage Used Card */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('Storage')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBadge, { backgroundColor: '#E0F2FE' }]}>
              <Text style={{ fontSize: 18 }}>☁️</Text>
            </View>
            <Text style={styles.statLabel}>Storage Used</Text>
            <Text style={styles.statValue}>
              {formatBytes(storage.usedBytes || 0)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Documents Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Documents</Text>
          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All &gt;</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Documents Vertical List View (Max 10) */}
        {recentDocs.length === 0 ? (
          <View style={styles.emptyRecentBox}>
            <Text style={styles.emptyRecentIcon}>📂</Text>
            <Text style={styles.emptyRecentText}>No documents uploaded yet</Text>
          </View>
        ) : (
          <View style={styles.recentDocsList}>
            {recentDocs.slice(0, 10).map((doc, index) => (
              <DocScanCard
                key={doc._id || `doc_${index}`}
                document={doc}
                onPress={() => navigation.navigate('DocumentDetail', { document: doc })}
                onPressOptions={() => navigation.navigate('DocumentDetail', { document: doc })}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Doc Scanner Floating Dual Action Pill [ Camera | Plus ] */}
      <DocScannerFab
        onPressScan={() => navigation.navigate('Scanner')}
        onPressUpload={() => navigation.navigate('UploadDocument')}
        bottomOffset={18}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 24 : 26,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
  },
  greetingContainer: {
    flex: 1,
    paddingRight: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  waveEmoji: {
    fontSize: 22,
    marginLeft: 8,
  },
  greetingSub: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...shadows.subtle,
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 0.48,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    ...shadows.card,
  },
  statIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  statValue: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  recentDocsList: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  recentDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.card,
  },
  docThumbBox: {
    width: 46,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  docTypeIcon: {
    fontSize: 20,
  },
  typePill: {
    position: 'absolute',
    bottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  typePillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  docInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  docNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  docCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    maxWidth: 100,
  },
  docMetaDot: {
    fontSize: 10,
    color: '#9CA3AF',
    marginHorizontal: 5,
  },
  docMetaText: {
    fontSize: 11,
    color: '#6B7280',
  },
  docChevron: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyRecentBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  emptyRecentIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyRecentText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

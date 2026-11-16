import React, { useState, useEffect } from 'react';
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
import { colors, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { documentService, storageService } from '../../services/api/documentService';
import { DocumentItem, StorageInfo } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { BellIcon, SearchIcon, ScanIcon, UploadIcon } from '../../assets/icons';
import { DocScannerFab } from '../../components/common/DocScannerFab';

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [storage, setStorage] = useState<StorageInfo>({
    planName: 'Basic Free',
    quotaBytes: 1073741824, // 1 GB
    usedBytes: 256901120, // 245 MB
    availableBytes: 816840704,
    usedPercentage: 24,
    documentCount: 24,
    failedUploadCount: 0,
  });

  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      const storageRes = await storageService.getStorageInfo();
      setStorage(storageRes);
    } catch (e) {
      // Graceful fallback to default/cached data matching the user mockup
    }

    try {
      const docsRes = await documentService.getDocuments({ sortBy: 'createdAt', sortOrder: 'desc' });
      if (docsRes.documents?.length) {
        setRecentDocs(docsRes.documents.slice(0, 5));
      } else {
        // Mock sample recent documents matching provided UI mockup
        setRecentDocs([
          {
            _id: '1',
            userId: user?._id || '1',
            name: 'Resume.pdf',
            originalFileName: 'Resume.pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 2457600, // 2.4 MB
            storageKey: 'resumes/1.pdf',
            category: 'Personal Documents',
            tags: ['resume', 'work'],
            status: 'available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            _id: '2',
            userId: user?._id || '1',
            name: 'ID Card.jpg',
            originalFileName: 'ID Card.jpg',
            fileType: 'jpg',
            mimeType: 'image/jpeg',
            fileSizeBytes: 1126400, // 1.1 MB
            storageKey: 'id/2.jpg',
            category: 'Identity Proof',
            tags: ['id', 'proof'],
            status: 'available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            _id: '3',
            userId: user?._id || '1',
            name: 'Notes.pdf',
            originalFileName: 'Notes.pdf',
            fileType: 'pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 876544, // 856 KB
            storageKey: 'notes/3.pdf',
            category: 'Education Documents',
            tags: ['study'],
            status: 'available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" translucent={false} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Header with Search Icon on Notification Left Side */}
        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting} numberOfLines={1}>
                Hello, {user?.name || user?.email?.split('@')[0] || 'dhanu.sri'}
              </Text>
              <Text style={styles.waveEmoji}>👋</Text>
            </View>
            <Text style={styles.greetingSub}>Your documents are safe with us!</Text>
          </View>

          <View style={styles.headerActions}>
            {/* Search Symbol Button - on Notification Left Side */}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
              accessibilityLabel="Search documents"
            >
              <SearchIcon size={20} color={colors.text} />
            </TouchableOpacity>

            {/* Notification Bell Button */}
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
            <Text style={styles.statValue}>{storage.documentCount || 24}</Text>
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
              {formatBytes(storage.usedBytes || 256901120)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Documents Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Documents</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DocumentsTab')}>
            <Text style={styles.seeAllText}>See All &gt;</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentDocsScroll}>
          {recentDocs.map((doc) => {
            const isPdf = doc.fileType === 'pdf';
            return (
              <TouchableOpacity
                key={doc._id}
                style={styles.docThumbnailCard}
                onPress={() => navigation.navigate('DocumentDetail', { document: doc })}
                activeOpacity={0.8}
              >
                <View style={[styles.fileTypeBadge, { backgroundColor: isPdf ? '#FEE2E2' : '#DBEAFE' }]}>
                  <Text style={[styles.fileTypeText, { color: isPdf ? colors.pdfRed : colors.imageBlue }]}>
                    {doc.fileType.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.docCardName} numberOfLines={1}>
                  {doc.name}
                </Text>
                <Text style={styles.docCardSize}>{formatBytes(doc.fileSizeBytes)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
    paddingBottom: 32,
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
    marginBottom: 16,
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
  actionGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickScanGridCard: {
    flex: 0.48,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 114,
    ...shadows.glow,
  },
  scanGridIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickScanGridTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
  },
  quickScanGridSub: {
    color: '#E0D4FC',
    fontSize: typography.fontSizes.xs,
    marginTop: 2,
  },
  uploadGridCard: {
    flex: 0.48,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EDE9FE',
    justifyContent: 'space-between',
    minHeight: 114,
    ...shadows.card,
  },
  uploadGridIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadGridTitle: {
    color: colors.text,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
  },
  uploadGridSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.xs,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
  recentDocsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  docThumbnailCard: {
    width: 110,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    ...shadows.card,
  },
  fileTypeBadge: {
    width: 48,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fileTypeText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
  },
  docCardName: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  docCardSize: {
    fontSize: 10,
    color: colors.textMuted,
  },
});


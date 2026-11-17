import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { documentService } from '../../services/api/documentService';
import { shareService } from '../../services/shareService';
import { getCategoryEmoji } from '../../services/api/categoryService';
import { formatBytes, formatDate } from '../../utils/formatters';
import { deduplicateDocuments } from '../../utils/documentUtils';
import { DocScanCard } from '../../components/common/DocScanCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CategoryDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const categoryName: string = route.params?.category || 'Personal Documents';
  const categoryColor: string = route.params?.color || '#6C47FF';
  const categoryIcon: string = route.params?.icon || 'folder';
  const emoji = getCategoryEmoji(categoryName, categoryIcon);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'All' | 'PDF' | 'Images'>('All');

  const fetchCategoryDocuments = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // 1. Sync pending documents
      try {
        await documentService.syncOfflineDocuments();
      } catch {}

      // 2. Fetch offline documents
      let localDocs: DocumentItem[] = [];
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cached) {
          const parsed = JSON.parse(cached);
          localDocs = deduplicateDocuments(parsed);
          if (localDocs.length !== parsed.length) {
            await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(localDocs));
          }
        }
      } catch {}

      // 3. Fetch server documents
      let serverDocs: DocumentItem[] = [];
      try {
        const res = await documentService.getDocuments({
          category: categoryName,
        });
        if (res && Array.isArray(res.documents)) {
          serverDocs = deduplicateDocuments(res.documents);
        }
      } catch (err) {
        console.warn('[CategoryDetailScreen] Failed to fetch server docs:', err);
      }

      // Merge & deduplicate so each document shows ONLY ONCE
      const allMerged = deduplicateDocuments([...serverDocs, ...localDocs]);

      // Filter specifically for this category (case-insensitive substring match)
      const targetLower = categoryName.trim().toLowerCase();
      const categoryFiltered = allMerged.filter((doc) => {
        const docCat = (doc.category || '').trim().toLowerCase();
        return (
          docCat === targetLower ||
          docCat.includes(targetLower) ||
          targetLower.includes(docCat)
        );
      });

      setDocuments(categoryFiltered);
    } catch (e) {
      console.warn('[CategoryDetailScreen] Error fetching category docs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryName]);

  useFocusEffect(
    useCallback(() => {
      fetchCategoryDocuments(false);
    }, [fetchCategoryDocuments])
  );

  useEffect(() => {
    fetchCategoryDocuments(false);
  }, [fetchCategoryDocuments]);

  // Filter by search & file type tab
  const displayedDocuments = documents.filter((doc) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchesName = doc.name.toLowerCase().includes(q);
      const matchesNotes = doc.notes ? doc.notes.toLowerCase().includes(q) : false;
      const matchesTags = doc.tags ? doc.tags.some((t) => t.toLowerCase().includes(q)) : false;
      if (!matchesName && !matchesNotes && !matchesTags) return false;
    }

    if (activeTab === 'PDF') {
      return doc.fileType === 'pdf' || doc.name.toLowerCase().endsWith('.pdf');
    }
    if (activeTab === 'Images') {
      return (
        doc.fileType === 'jpg' ||
        doc.fileType === 'png' ||
        doc.fileType === 'jpeg' ||
        doc.name.toLowerCase().endsWith('.jpg') ||
        doc.name.toLowerCase().endsWith('.png') ||
        doc.name.toLowerCase().endsWith('.jpeg')
      );
    }
    return true;
  });

  const handleDeleteDoc = (doc: DocumentItem) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from server if ObjectId
              if (/^[0-9a-fA-F]{24}$/.test(doc._id)) {
                try {
                  await documentService.deleteDocument(doc._id);
                } catch {}
              }
              // Delete from offline cache
              const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
              if (cached) {
                const list: DocumentItem[] = JSON.parse(cached);
                const updated = list.filter((d) => d._id !== doc._id && d.name !== doc.name);
                await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
              }
              setDocuments((prev) => prev.filter((d) => d._id !== doc._id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete document.');
            }
          },
        },
      ]
    );
  };

  const handleShareDoc = async (doc: DocumentItem) => {
    try {
      await shareService.shareDocument(doc);
    } catch (e: any) {
      Alert.alert('Share Error', e.message || 'Could not share document.');
    }
  };

  const renderDocCard = ({ item }: { item: DocumentItem }) => {
    return (
      <DocScanCard
        document={item}
        onPress={() => navigation.navigate('DocumentDetail', { document: item })}
        onPressOptions={() => {
          Alert.alert(item.name, 'Choose an action for this document:', [
            { text: '📤 Share', onPress: () => handleShareDoc(item) },
            { text: '🗑️ Delete', style: 'destructive', onPress: () => handleDeleteDoc(item) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <View style={styles.categoryTitleRow}>
            <Text style={styles.categoryEmoji}>{emoji}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {categoryName}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </Text>
        </View>

        {/* Quick Add / Scan button */}
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() =>
            navigation.navigate('UploadDocument', {
              defaultCategory: categoryName,
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.headerAddBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search in ${categoryName}...`}
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearchIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs: All | PDF | Images */}
      <View style={styles.tabsRow}>
        {(['All', 'PDF', 'Images'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Document List or Empty State */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading {categoryName}...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedDocuments}
          keyExtractor={(item) => item._id}
          renderItem={renderDocCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCategoryDocuments(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: categoryColor + '18' }]}>
                <Text style={styles.emptyEmoji}>{emoji}</Text>
              </View>
              <Text style={styles.emptyTitle}>No documents in {categoryName}</Text>
              <Text style={styles.emptySubtitle}>
                Upload or scan documents and select "{categoryName}" to view them in this category.
              </Text>

              <View style={styles.emptyActionsRow}>
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={() => navigation.navigate('Scanner')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>📷 Scan Document</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() =>
                    navigation.navigate('UploadDocument', {
                      defaultCategory: categoryName,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.uploadBtnText}>📁 Upload File</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    ...shadows.card,
  },
  backBtn: {
    padding: 8,
    marginRight: 6,
  },
  backArrow: {
    fontSize: 22,
    color: '#1F2937',
    fontWeight: 'bold',
  },
  headerTitleBox: {
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: '#111827',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  headerAddBtn: {
    backgroundColor: colors.primary || '#6C47FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 2,
  },
  clearSearchIcon: {
    fontSize: 14,
    color: '#9CA3AF',
    paddingHorizontal: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabBtnActive: {
    backgroundColor: colors.primary || '#6C47FF',
    borderColor: colors.primary || '#6C47FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.card,
  },
  docThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 12,
    overflow: 'hidden',
  },
  pdfThumbBox: {
    backgroundColor: '#FEE2E2',
  },
  imgThumbBox: {
    backgroundColor: '#E0E7FF',
  },
  docThumbImage: {
    width: '100%',
    height: '100%',
  },
  docThumbIcon: {
    fontSize: 22,
  },
  typeBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pdfBadge: {
    backgroundColor: '#EF4444',
  },
  imgBadge: {
    backgroundColor: '#3B82F6',
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  docInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  docName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaDot: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 5,
  },
  notesText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  docActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  actionIconText: {
    fontSize: 16,
  },
  actionDeleteText: {
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyEmoji: {
    fontSize: 38,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanBtn: {
    backgroundColor: colors.primary || '#6C47FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary || '#6C47FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  uploadBtnText: {
    color: colors.primary || '#6C47FF',
    fontSize: 13,
    fontWeight: '700',
  },
});

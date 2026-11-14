import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { documentService } from '../../services/api/documentService';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { SearchIcon } from '../../assets/icons';

const TABS = ['All', 'PDF', 'Images', 'Others'];

export const DocumentsListScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(route?.params?.category || null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isGridView, setIsGridView] = useState(true);

  useEffect(() => {
    if (route?.params?.category) {
      setSelectedCategory(route?.params?.category);
    }
  }, [route?.params?.category]);

  const fetchDocs = useCallback(async () => {
    let localDocs: DocumentItem[] = [];
    try {
      const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
      if (cached) {
        localDocs = JSON.parse(cached);
      }
    } catch {
      // ignore
    }

    let serverDocs: DocumentItem[] = [];
    try {
      const res = await documentService.getDocuments({
        search: search.trim() || undefined,
        fileType: activeTab === 'PDF' ? 'pdf' : activeTab === 'Images' ? 'jpg' : undefined,
      });
      if (res && Array.isArray(res.documents)) {
        serverDocs = res.documents;
      }
    } catch (e) {
      console.warn('[DocumentsListScreen] Failed to fetch server docs:', e);
    }

    // Merge server docs and local offline docs (deduplicate by _id or name)
    const combinedMap = new Map<string, DocumentItem>();
    serverDocs.forEach((d) => combinedMap.set(d._id, d));
    localDocs.forEach((d) => {
      if (!combinedMap.has(d._id)) {
        combinedMap.set(d._id, d);
      }
    });

    let merged = Array.from(combinedMap.values());

    // If active tab filter applies
    if (activeTab === 'PDF') {
      merged = merged.filter((d) => d.fileType === 'pdf' || d.name.toLowerCase().endsWith('.pdf'));
    } else if (activeTab === 'Images') {
      merged = merged.filter(
        (d) =>
          d.fileType === 'jpg' ||
          d.fileType === 'png' ||
          d.fileType === 'jpeg' ||
          d.name.toLowerCase().endsWith('.jpg') ||
          d.name.toLowerCase().endsWith('.png') ||
          d.name.toLowerCase().endsWith('.jpeg')
      );
    } else if (activeTab === 'Others') {
      merged = merged.filter(
        (d) =>
          d.fileType !== 'pdf' &&
          d.fileType !== 'jpg' &&
          d.fileType !== 'png' &&
          d.fileType !== 'jpeg'
      );
    }

    // Filter by search query if typed
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      merged = merged.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category?.toLowerCase().includes(q) ||
          (d.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter by selected category if navigated from Categories tab
    if (selectedCategory) {
      const catLower = selectedCategory.trim().toLowerCase();
      merged = merged.filter((d) => (d.category || '').trim().toLowerCase() === catLower);
    }

    setDocuments(merged);
  }, [activeTab, search, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      fetchDocs();
    }, [fetchDocs])
  );

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDocs();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: DocumentItem }) => {
    const isPdf = item.fileType === 'pdf';
    const thumbUri = item.localUri || item.thumbnailUrl;
    return (
      <TouchableOpacity
        style={[styles.docCard, isGridView ? styles.gridCard : styles.listCard]}
        onPress={() => navigation.navigate('DocumentDetail', { document: item })}
        activeOpacity={0.8}
      >
        <View style={[styles.cardThumb, { backgroundColor: isPdf ? '#FEE2E2' : '#DBEAFE', overflow: 'hidden' }]}>
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.thumbText, { color: isPdf ? colors.pdfRed : colors.imageBlue }]}>
              {item.fileType.toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.docName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.docMeta}>
            {formatBytes(item.fileSizeBytes)} • {formatDate(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Documents</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setIsGridView(!isGridView)}
          >
            <Text style={styles.actionIcon}>{isGridView ? '☰' : '⊞'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active Category Filter Banner */}
      {selectedCategory && (
        <View style={styles.categoryFilterBanner}>
          <Text style={styles.categoryFilterText}>
            Showing: <Text style={styles.categoryFilterHighlight}>{selectedCategory}</Text>
          </Text>
          <TouchableOpacity
            style={styles.clearCategoryBtn}
            onPress={() => {
              setSelectedCategory(null);
              navigation.setParams({ category: undefined });
            }}
          >
            <Text style={styles.clearCategoryBtnText}>✕ Show All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Documents Grid / List */}
      <FlatList
        key={isGridView ? 'grid_2' : 'list_1'}
        numColumns={isGridView ? 2 : 1}
        data={documents}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContainer, documents.length === 0 && styles.listContainerEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No Documents Yet</Text>
            <Text style={styles.emptySubtitle}>
              You haven't added any documents in this view. Tap below to scan or upload a document.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('UploadDocument')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>+ Upload Document</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 6,
  },
  actionIcon: {
    fontSize: 20,
    color: colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoryFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  categoryFilterText: {
    fontSize: typography.fontSizes.sm,
    color: '#3730A3',
  },
  categoryFilterHighlight: {
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  clearCategoryBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.sm,
  },
  clearCategoryBtnText: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.bold,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 14,
    ...shadows.card,
  },
  gridCard: {
    flex: 0.48,
    marginHorizontal: '1%',
    alignItems: 'center',
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  thumbText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardInfo: {
    alignItems: 'center',
  },
  docName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  docMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  listContainerEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: borderRadius.pill,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});


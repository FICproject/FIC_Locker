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
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { documentService } from '../../services/api/documentService';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { SearchIcon } from '../../assets/icons';
import { RenameDocumentModal } from '../../components/modals/RenameDocumentModal';
import { MoveDocumentModal } from '../../components/modals/MoveDocumentModal';

const TABS = ['All', 'PDF', 'Images', 'Others'];

type SortOption =
  | 'date_desc'
  | 'date_asc'
  | 'name_asc'
  | 'name_desc'
  | 'size_desc'
  | 'size_asc';

const SORT_LABELS: Record<SortOption, string> = {
  date_desc: 'Newest First',
  date_asc: 'Oldest First',
  name_asc: 'Name (A - Z)',
  name_desc: 'Name (Z - A)',
  size_desc: 'Size (Largest)',
  size_asc: 'Size (Smallest)',
};

export const DocumentsListScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    route?.params?.category || null
  );
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isGridView, setIsGridView] = useState(true);

  // Sorting State
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Document action modals
  const [selectedDocForAction, setSelectedDocForAction] = useState<DocumentItem | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  useEffect(() => {
    if (route?.params?.category) {
      setSelectedCategory(route?.params?.category);
    }
  }, [route?.params?.category]);

  const fetchDocs = useCallback(async () => {
    // 1. Sync any pending offline/scanned documents to backend server
    try {
      await documentService.syncOfflineDocuments();
    } catch {}

    let localDocs: DocumentItem[] = [];
    try {
      const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
      if (cached) {
        localDocs = JSON.parse(cached);
      }
    } catch {}

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

    // Filter by search query including OCR text
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      merged = merged.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category?.toLowerCase().includes(q) ||
          (d.tags || []).some((t) => t.toLowerCase().includes(q)) ||
          (d.ocrText || '').toLowerCase().includes(q)
      );
    }

    // Filter by selected category if navigated from Categories tab
    if (selectedCategory) {
      const catLower = selectedCategory.trim().toLowerCase();
      merged = merged.filter((d) => (d.category || '').trim().toLowerCase() === catLower);
    }

    // Apply Sorting
    merged.sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'size_desc':
          return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
        case 'size_asc':
          return (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
        default:
          return 0;
      }
    });

    setDocuments(merged);
  }, [activeTab, search, selectedCategory, sortOption]);

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

  const handleDocumentLongPress = (item: DocumentItem) => {
    setSelectedDocForAction(item);
    Alert.alert(item.name, 'Choose an action for this document:', [
      {
        text: '✏️ Rename',
        onPress: () => setRenameModalVisible(true),
      },
      {
        text: '📁 Move to Folder',
        onPress: () => setMoveModalVisible(true),
      },
      {
        text: '🗑️ Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Document', `Permanently delete "${item.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await documentService.deleteDocument(item._id);
                } catch {}
                try {
                  const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
                  if (cached) {
                    const list: DocumentItem[] = JSON.parse(cached);
                    const updated = list.filter((d) => d._id !== item._id && d.name !== item.name);
                    await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
                  }
                } catch {}
                fetchDocs();
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: DocumentItem }) => {
    const isPdf = item.fileType === 'pdf';
    const thumbUri = item.localUri || item.thumbnailUrl;
    return (
      <TouchableOpacity
        style={[styles.docCard, isGridView ? styles.gridCard : styles.listCard]}
        onPress={() => navigation.navigate('DocumentDetail', { document: item })}
        onLongPress={() => handleDocumentLongPress(item)}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.cardThumb,
            { backgroundColor: isPdf ? '#FEE2E2' : '#DBEAFE', overflow: 'hidden' },
          ]}
        >
          {thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <Text
              style={[
                styles.thumbText,
                { color: isPdf ? colors.pdfRed : colors.imageBlue },
              ]}
            >
              {item.fileType.toUpperCase()}
            </Text>
          )}

          {item.ocrText ? (
            <View style={styles.ocrChipBadge}>
              <Text style={styles.ocrChipBadgeText}>OCR</Text>
            </View>
          ) : null}
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
          {/* Search Shortcut */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.actionIcon}>🔍</Text>
          </TouchableOpacity>

          {/* Sort Selector */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setSortModalVisible(true)}
          >
            <Text style={styles.actionIcon}>⇅</Text>
          </TouchableOpacity>

          {/* Grid / List Toggle */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setIsGridView(!isGridView)}
          >
            <Text style={styles.actionIcon}>{isGridView ? '☰' : '⊞'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs & Active Sort Tag */}
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

      {/* Active Filter & Sort Info Bar */}
      <View style={styles.infoStrip}>
        <Text style={styles.infoStripText}>
          Sort: <Text style={{ color: colors.primary, fontWeight: '700' }}>{SORT_LABELS[sortOption]}</Text>
        </Text>
        <Text style={styles.infoStripText}>{documents.length} item(s)</Text>
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
        contentContainerStyle={[
          styles.listContainer,
          documents.length === 0 && styles.listContainerEmpty,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>No Documents Found</Text>
            <Text style={styles.emptySubtitle}>
              Scan new pages or upload existing files to store them securely.
            </Text>
          </View>
        }
      />

      {/* Sort Selection Modal */}
      <Modal
        visible={sortModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.sortOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.sortCard}>
            <Text style={styles.sortTitle}>Sort Documents</Text>

            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
              const isSelected = sortOption === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.sortRow, isSelected && styles.sortRowActive]}
                  onPress={() => {
                    setSortOption(key);
                    setSortModalVisible(false);
                  }}
                >
                  <Text style={[styles.sortLabel, isSelected && styles.sortLabelActive]}>
                    {SORT_LABELS[key]}
                  </Text>
                  {isSelected && <Text style={styles.sortCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename Modal */}
      <RenameDocumentModal
        visible={renameModalVisible}
        document={selectedDocForAction}
        onSuccess={() => fetchDocs()}
        onClose={() => setRenameModalVisible(false)}
      />

      {/* Move Modal */}
      <MoveDocumentModal
        visible={moveModalVisible}
        document={selectedDocForAction}
        onSuccess={() => fetchDocs()}
        onClose={() => setMoveModalVisible(false)}
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
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4F4FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 16,
    color: colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoStripText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  categoryFilterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryFilterText: {
    fontSize: 12,
    color: colors.primaryDark,
  },
  categoryFilterHighlight: {
    fontWeight: 'bold',
  },
  clearCategoryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  clearCategoryBtnText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 14,
  },
  listContainerEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 10,
    ...shadows.subtle,
  },
  gridCard: {
    flex: 0.5,
    margin: 6,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardThumb: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ocrChipBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ocrChipBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  cardInfo: {
    marginTop: 8,
  },
  docName: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.text,
  },
  docMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  sortOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sortCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 20,
    elevation: 8,
  },
  sortTitle: {
    fontSize: 17,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: 14,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
  },
  sortRowActive: {
    backgroundColor: '#EDE9FE',
  },
  sortLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  sortLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  sortCheck: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DEFAULT_CATEGORIES } from '../../constants';
import { CategoryItem } from '../../types';
import { categoryService, getCategoryEmoji } from '../../services/api/categoryService';
import { documentService } from '../../services/api/documentService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deduplicateDocuments } from '../../utils/documentUtils';

export const CategoriesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    DEFAULT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    }))
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6C47FF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});

  const COLOR_OPTIONS = ['#6C47FF', '#2563EB', '#059669', '#E11D48', '#D97706', '#7C3AED'];

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Category Name Required', 'Please enter a name for the new category.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await categoryService.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
        color: newCatColor,
      });
      setCategories((prev) => {
        const filtered = prev.filter((c) => c.name.toLowerCase() !== created.name.toLowerCase());
        return [created, ...filtered];
      });
      setAddModalVisible(false);
      setNewCatName('');
      setNewCatDesc('');
      Alert.alert('Category Added', `"${created.name}" is now available in your document categories.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadCategories = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      // First load cached immediately if empty
      const cached = await categoryService.getCachedCategories();
      if (cached && cached.length > 0) {
        setCategories(cached);
      }
    }

    try {
      const serverCategories = await categoryService.fetchCategories();
      if (serverCategories && serverCategories.length > 0) {
        setCategories(serverCategories);
      }
    } catch (err) {
      console.warn('[CategoriesScreen] Failed to refresh categories:', err);
    }

    // Load document counts per category
    try {
      let localDocs: any[] = [];
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cached) localDocs = deduplicateDocuments(JSON.parse(cached));
      } catch {}

      let serverDocs: any[] = [];
      try {
        const res = await documentService.getDocuments();
        if (res && res.documents) {
          serverDocs = deduplicateDocuments(res.documents);
        }
      } catch {}

      const allDocs = deduplicateDocuments([...serverDocs, ...localDocs]);

      const counts: Record<string, number> = {};
      allDocs.forEach((d) => {
        const cat = (d.category || '').trim().toLowerCase();
        if (cat) {
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      setDocCounts(counts);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch when screen gains focus (e.g. user modified in admin, comes back to app)
  useFocusEffect(
    useCallback(() => {
      loadCategories(false);
    }, [loadCategories])
  );

  useEffect(() => {
    loadCategories(false);
  }, [loadCategories]);

  const onRefresh = () => {
    loadCategories(true);
  };

  const renderItem = ({ item }: { item: CategoryItem }) => {
    const itemColor = item.color || '#6C47FF';
    const emoji = getCategoryEmoji(item.name, item.icon);
    const key = item.name.trim().toLowerCase();
    const count = docCounts[key] || 0;

    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() =>
          navigation.navigate('CategoryDetail', {
            category: item.name,
            color: itemColor,
            icon: item.icon,
          })
        }
        activeOpacity={0.8}
      >
        <View style={styles.cardIconBox}>
          <View style={[styles.iconWrapper, { backgroundColor: itemColor + '18' }]}>
            <Text style={styles.categoryEmoji}>{emoji}</Text>
          </View>
          {count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: itemColor }]}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.categoryTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.categoryDesc} numberOfLines={1}>
          {count > 0 ? `${count} ${count === 1 ? 'document' : 'documents'}` : item.description}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Categories</Text>
            <Text style={styles.subtitle}>
              {categories.length} {categories.length === 1 ? 'category' : 'categories'} available
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addCategoryBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addCategoryBtnText}>+ Add Category</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && categories.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      ) : (
        <FlatList
          numColumns={2}
          data={categories}
          keyExtractor={(item) => String(item.id || item._id || item.name)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Add Category Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Document Category</Text>
              <Text style={styles.modalEmojiPreview}>{getCategoryEmoji(newCatName)}</Text>
            </View>

            <Text style={styles.inputLabel}>Category Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Tax Records, Certificates, Property"
              placeholderTextColor="#9CA3AF"
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Official receipts, records & files"
              placeholderTextColor="#9CA3AF"
              value={newCatDesc}
              onChangeText={setNewCatDesc}
            />

            <Text style={styles.inputLabel}>Badge Color</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    newCatColor === c && styles.colorCircleSelected,
                  ]}
                  onPress={() => setNewCatColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setAddModalVisible(false);
                  setNewCatName('');
                  setNewCatDesc('');
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateCategory}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Category</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addCategoryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    ...shadows.subtle,
  },
  addCategoryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },
  categoryCard: {
    flex: 0.5,
    margin: 8,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 145,
    ...shadows.card,
  },
  iconWrapper: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryDesc: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 24,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalEmojiPreview: {
    fontSize: 26,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

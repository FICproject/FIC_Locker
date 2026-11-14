import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DEFAULT_CATEGORIES } from '../../constants';
import { CategoryItem } from '../../types';
import { categoryService, getCategoryEmoji } from '../../services/api/categoryService';

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
    } finally {
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

    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => navigation.navigate('DocumentsTab', { category: item.name })}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrapper, { backgroundColor: itemColor + '18' }]}>
          <Text style={styles.categoryEmoji}>{emoji}</Text>
        </View>
        <Text style={styles.categoryTitle} numberOfLines={2}>
          {item.name}
        </Text>
        {!!item.description && (
          <Text style={styles.categoryDesc} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>
          {categories.length} {categories.length === 1 ? 'category' : 'categories'} available
        </Text>
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
    marginBottom: 12,
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
});

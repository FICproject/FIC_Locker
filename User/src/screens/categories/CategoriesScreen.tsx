import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DEFAULT_CATEGORIES } from '../../constants';

export const CategoriesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const renderItem = ({ item }: { item: typeof DEFAULT_CATEGORIES[0] }) => {
    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => navigation.navigate('DocumentsTab', { category: item.name })}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrapper, { backgroundColor: item.color + '1A' }]}>
          <Text style={{ fontSize: 28 }}>
            {item.name.includes('Personal')
              ? '👤'
              : item.name.includes('Identity')
              ? '🛡️'
              : item.name.includes('Education')
              ? '🎓'
              : item.name.includes('Financial')
              ? '💰'
              : item.name.includes('Medical')
              ? '➕'
              : '📁'}
          </Text>
        </View>
        <Text style={styles.categoryTitle}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
      </View>

      <FlatList
        numColumns={2}
        data={DEFAULT_CATEGORIES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  listContainer: {
    paddingHorizontal: 14,
    paddingBottom: 30,
  },
  categoryCard: {
    flex: 0.48,
    margin: 8,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
  },
});


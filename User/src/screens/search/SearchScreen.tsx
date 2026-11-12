import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { formatBytes } from '../../utils/formatters';

export const SearchScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const [query, setQuery] = useState(route.params?.initialQuery || '');
  const [results, setResults] = useState<DocumentItem[]>([]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    // Filter matching metadata (Document name, category, tags) without AI extraction
    const mockDb: DocumentItem[] = [
      {
        _id: '1',
        userId: '1',
        name: 'Resume.pdf',
        originalFileName: 'Resume.pdf',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2457600,
        storageKey: '1.pdf',
        category: 'Personal Documents',
        tags: ['resume', 'cv'],
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: '2',
        userId: '1',
        name: 'ID Card.jpg',
        originalFileName: 'ID Card.jpg',
        fileType: 'jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1126400,
        storageKey: '2.jpg',
        category: 'Identity Proof',
        tags: ['national id', 'passport'],
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: '3',
        userId: '1',
        name: 'Project Report.pdf',
        originalFileName: 'Project Report.pdf',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 3145728,
        storageKey: '3.pdf',
        category: 'Education Documents',
        tags: ['project', 'report'],
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const q = text.toLowerCase();
    const filtered = mockDb.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
    );
    setResults(filtered);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, category, or tags..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.itemCard}
            onPress={() => navigation.navigate('DocumentDetail', { document: item })}
          >
            <View>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSub}>
                {item.category} • {formatBytes(item.fileSizeBytes)}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim() ? (
            <Text style={styles.emptyText}>No matching documents found.</Text>
          ) : (
            <Text style={styles.emptyText}>Type keywords to search metadata.</Text>
          )
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    height: 48,
    color: colors.text,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: borderRadius.md,
    ...shadows.subtle,
  },
  itemTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.text,
  },
  itemSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  arrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: colors.textMuted,
    fontSize: typography.fontSizes.sm,
  },
});


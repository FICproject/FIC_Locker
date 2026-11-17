import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { documentService } from '../../services/api/documentService';
import { deduplicateDocuments } from '../../utils/documentUtils';

type SearchFilterScope = 'all' | 'name' | 'ocr' | 'pdf' | 'images';

interface SearchResultItem extends DocumentItem {
  matchReason?: 'name' | 'ocr' | 'tags' | 'category';
  ocrSnippet?: string;
}

export const SearchScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const [query, setQuery] = useState(route.params?.initialQuery || '');
  const [activeScope, setActiveScope] = useState<SearchFilterScope>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadAllDocuments();
  }, []);

  const loadAllDocuments = async () => {
    setLoading(true);
    let localDocs: DocumentItem[] = [];
    try {
      const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
      if (cached) {
        localDocs = deduplicateDocuments(JSON.parse(cached));
      }
    } catch {}

    let serverDocs: DocumentItem[] = [];
    try {
      const res = await documentService.getDocuments();
      if (res && Array.isArray(res.documents)) {
        serverDocs = deduplicateDocuments(res.documents);
      }
    } catch {}

    const combined = deduplicateDocuments([...serverDocs, ...localDocs]);
    setAllDocs(combined);
    setLoading(false);

    if (query.trim()) {
      executeSearch(query, activeScope, combined);
    }
  };

  const executeSearch = (text: string, scope: SearchFilterScope, docsPool: DocumentItem[]) => {
    if (!text.trim()) {
      setResults([]);
      return;
    }

    const q = text.trim().toLowerCase();
    const matchedItems: SearchResultItem[] = [];

    docsPool.forEach((doc) => {
      let isMatch = false;
      let reason: 'name' | 'ocr' | 'tags' | 'category' = 'name';
      let snippet = '';

      const nameMatch = doc.name.toLowerCase().includes(q);
      const tagMatch = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
      const catMatch = (doc.category || '').toLowerCase().includes(q);
      const ocrMatch = (doc.ocrText || '').toLowerCase().includes(q);

      if (ocrMatch) {
        // Find snippet around matched word
        const fullOcr = doc.ocrText || '';
        const idx = fullOcr.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 25);
        const end = Math.min(fullOcr.length, idx + q.length + 25);
        snippet = `"...${fullOcr.substring(start, end).replace(/\n/g, ' ')}..."`;
      }

      if (scope === 'all') {
        if (nameMatch) {
          isMatch = true;
          reason = 'name';
        } else if (ocrMatch) {
          isMatch = true;
          reason = 'ocr';
        } else if (tagMatch) {
          isMatch = true;
          reason = 'tags';
        } else if (catMatch) {
          isMatch = true;
          reason = 'category';
        }
      } else if (scope === 'name') {
        if (nameMatch) {
          isMatch = true;
          reason = 'name';
        }
      } else if (scope === 'ocr') {
        if (ocrMatch) {
          isMatch = true;
          reason = 'ocr';
        }
      } else if (scope === 'pdf') {
        if ((doc.fileType === 'pdf' || doc.name.toLowerCase().endsWith('.pdf')) && (nameMatch || ocrMatch || tagMatch)) {
          isMatch = true;
          reason = ocrMatch ? 'ocr' : 'name';
        }
      } else if (scope === 'images') {
        if (doc.fileType !== 'pdf' && (nameMatch || ocrMatch || tagMatch)) {
          isMatch = true;
          reason = ocrMatch ? 'ocr' : 'name';
        }
      }

      if (isMatch) {
        matchedItems.push({
          ...doc,
          matchReason: reason,
          ocrSnippet: snippet,
        });
      }
    });

    setResults(matchedItems);
  };

  const handleSearchChange = (text: string) => {
    setQuery(text);
    executeSearch(text, activeScope, allDocs);
  };

  const handleScopeChange = (newScope: SearchFilterScope) => {
    setActiveScope(newScope);
    executeSearch(query, newScope, allDocs);
  };

  const scopes: Array<{ id: SearchFilterScope; label: string }> = [
    { id: 'all', label: 'All Fields' },
    { id: 'ocr', label: 'Extracted OCR Text' },
    { id: 'name', label: 'Document Name' },
    { id: 'pdf', label: 'PDFs' },
    { id: 'images', label: 'Images' },
  ];

  return (
    <View style={styles.container}>
      {/* Top Header & Search Input */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, category, or OCR text..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={handleSearchChange}
              autoFocus
            />
            {query ? (
              <TouchableOpacity onPress={() => handleSearchChange('')}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Scope Chips */}
        <View style={styles.scopesScroll}>
          {scopes.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.scopeChip, activeScope === s.id && styles.scopeChipActive]}
              onPress={() => handleScopeChange(s.id)}
            >
              <Text
                style={[styles.scopeChipText, activeScope === s.id && styles.scopeChipTextActive]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Results List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Indexing documents and OCR content...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isPdf = item.fileType === 'pdf';
            const thumbUri = item.localUri || item.thumbnailUrl;
            return (
              <TouchableOpacity
                style={styles.itemCard}
                onPress={() => navigation.navigate('DocumentDetail', { document: item })}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.thumbBox,
                    { backgroundColor: isPdf ? '#FEE2E2' : '#DBEAFE' },
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
                </View>

                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemSub}>
                    {item.category} • {formatBytes(item.fileSizeBytes)} • {formatDate(item.createdAt)}
                  </Text>

                  {/* Highlight Reason Badge */}
                  {item.matchReason === 'ocr' && (
                    <View style={styles.ocrMatchBox}>
                      <Text style={styles.ocrMatchBadge}>MATCHED OCR TEXT</Text>
                      {item.ocrSnippet ? (
                        <Text style={styles.ocrSnippetText} numberOfLines={2}>
                          {item.ocrSnippet}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>

                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No matching documents</Text>
                <Text style={styles.emptySub}>
                  No titles, categories, or extracted OCR text matched "{query}".
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>⚡</Text>
                <Text style={styles.emptyTitle}>Instant Full-Text Search</Text>
                <Text style={styles.emptySub}>
                  Search across document titles, folders, tags, and OCR text extracted from scanned pages.
                </Text>
              </View>
            )
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
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 22,
    color: colors.text,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  clearBtnText: {
    fontSize: 14,
    color: colors.textMuted,
    paddingHorizontal: 6,
  },
  scopesScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  scopeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: '#F3F4F6',
  },
  scopeChipActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  scopeChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scopeChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: borderRadius.lg,
    marginBottom: 10,
    ...shadows.subtle,
  },
  thumbBox: {
    width: 48,
    height: 56,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ocrMatchBox: {
    marginTop: 6,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  ocrMatchBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 2,
  },
  ocrSnippetText: {
    fontSize: 11,
    color: colors.text,
    fontStyle: 'italic',
  },
  arrow: {
    fontSize: 22,
    color: colors.textMuted,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textSecondary,
  },
});

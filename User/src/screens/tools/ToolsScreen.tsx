import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import {
  PdfToolItem,
  PdfCategoryGroup,
} from '../../types/pdfTools';
import { PDF_CATEGORIES, ALL_PDF_TOOLS } from '../../services/pdfEngineService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// User App Brand Palette: Primary Indigo/Purple
const PRIMARY = colors.primary; // '#6C47FF'
const PRIMARY_DARK = colors.primaryDark; // '#502DDE'
const PRIMARY_LIGHT = colors.primaryLight; // '#8F71FF'
const PRIMARY_SOFT = colors.primarySoft; // '#F4F0FF'

export const ToolsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>('all');

  // Filter tools based on search query and category tab
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return PDF_CATEGORIES.map((cat) => {
      // Check if category matches active filter
      if (activeCategoryKey !== 'all' && cat.key !== activeCategoryKey) {
        return { ...cat, tools: [] };
      }

      // Filter tools by search query
      const matchingTools = cat.tools.filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.subtitle.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q)
        );
      });

      return {
        ...cat,
        tools: matchingTools,
      };
    }).filter((cat) => cat.tools.length > 0);
  }, [searchQuery, activeCategoryKey]);

  const handleToolPress = (tool: PdfToolItem) => {
    if (tool.id === 'scan_to_pdf') {
      navigation.navigate('Scanner');
    } else {
      navigation.navigate('PdfToolDetail', {
        toolId: tool.id,
        toolTitle: tool.title,
      });
    }
  };

  const categoryTabs = [
    { key: 'all', label: 'All Tools', count: ALL_PDF_TOOLS.length },
    { key: 'management', label: 'Management', count: 10 },
    { key: 'editing', label: 'Editing', count: 9 },
    { key: 'convert_to', label: 'PDF to Other', count: 7 },
    { key: 'convert_from', label: 'Other to PDF', count: 6 },
    { key: 'security', label: 'Security', count: 6 },
    { key: 'advanced', label: 'Advanced', count: 5 },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_DARK} />

      {/* App Primary Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>FIC LOCKER PDF SUITE</Text>
          </View>
          <View style={styles.offlinePill}>
            <Text style={styles.offlinePillText}>⚡ 100% Offline</Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>PDF Tools</Text>
        <Text style={styles.headerSubtitle}>
          Complete professional suite for editing, converting & securing documents
        </Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search across 43 PDF tools..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Pills Bar */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBar}
        >
          {categoryTabs.map((tab) => {
            const isActive = activeCategoryKey === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setActiveCategoryKey(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isActive && styles.categoryPillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tools Content Grid */}
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {filteredCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No PDF Tools Found</Text>
            <Text style={styles.emptySubtitle}>
              No tools matched your search "{searchQuery}". Try a different keyword.
            </Text>
            <TouchableOpacity
              style={styles.resetSearchBtn}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.resetSearchText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredCategories.map((group, groupIdx) => (
            <View key={group.key} style={styles.categorySection}>
              {/* Category Header */}
              <View style={styles.categoryHeader}>
                <View style={styles.categoryTitleCol}>
                  <Text style={styles.categoryTitle}>{group.title}</Text>
                  <Text style={styles.categoryDesc}>{group.description}</Text>
                </View>
              </View>

              {/* Tools 4-Column Grid */}
              <View style={styles.toolsGrid}>
                {group.tools.map((tool) => (
                  <TouchableOpacity
                    key={tool.id}
                    style={styles.toolGridItem}
                    onPress={() => handleToolPress(tool)}
                    activeOpacity={0.75}
                  >
                    {/* Circular Tool Icon */}
                    <View style={styles.iconCircleWrapper}>
                      <View
                        style={[
                          styles.toolIconCircle,
                          { backgroundColor: tool.circleColor },
                        ]}
                      >
                        <Text style={styles.toolIconEmoji}>{tool.icon}</Text>
                      </View>

                      {/* Tool Badge if present */}
                      {tool.badge && (
                        <View
                          style={[
                            styles.toolMiniBadge,
                            {
                              backgroundColor: tool.badgeColor || PRIMARY,
                            },
                          ]}
                        >
                          <Text style={styles.toolMiniBadgeText}>
                            {tool.badge}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Tool Title */}
                    <Text style={styles.toolGridTitle} numberOfLines={2}>
                      {tool.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Subtle Section Divider */}
              {groupIdx < filteredCategories.length - 1 && (
                <View style={styles.sectionDivider} />
              )}
            </View>
          ))
        )}

        {/* Security & Offline Trust Banner */}
        <View style={styles.trustBanner}>
          <View style={styles.trustIconCircle}>
            <Text style={styles.trustIconText}>🛡️</Text>
          </View>
          <View style={styles.trustInfo}>
            <Text style={styles.trustTitle}>Private, On-Device PDF Processing</Text>
            <Text style={styles.trustSub}>
              All documents are processed locally without internet transmission or cloud leaks.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    backgroundColor: PRIMARY,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 54,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...shadows.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  offlinePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  offlinePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#E0D7FE',
    marginTop: 4,
    lineHeight: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 2,
    marginTop: 14,
    ...shadows.subtle,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 6,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  categoryBar: {
    paddingHorizontal: 14,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  pillCountBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pillCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
  },
  pillCountTextActive: {
    color: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  categorySection: {
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  categoryTitleCol: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  categoryDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  categoryToolBadge: {
    backgroundColor: PRIMARY_SOFT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0D7FE',
  },
  categoryToolBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.card,
  },
  toolGridItem: {
    width: '25%', // 4 Columns
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  iconCircleWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  toolIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  toolIconEmoji: {
    fontSize: 22,
  },
  toolMiniBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  toolMiniBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  toolGridTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 14,
    height: 28,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
    marginHorizontal: 10,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  resetSearchBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resetSearchText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: '#E0D7FE',
    borderRadius: borderRadius.md,
    padding: 12,
    marginTop: 10,
    gap: 12,
  },
  trustIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  trustIconText: {
    fontSize: 18,
  },
  trustInfo: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  trustSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
});

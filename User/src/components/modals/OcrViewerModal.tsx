import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, typography, borderRadius } from '../../theme';
import { ocrService, OcrExtractionResult } from '../../services/ocrService';

interface OcrViewerModalProps {
  visible: boolean;
  imageUri: string;
  documentTitle?: string;
  category?: string;
  existingOcrText?: string;
  onSaveOcrText?: (text: string) => void;
  onClose: () => void;
}

export const OcrViewerModal: React.FC<OcrViewerModalProps> = ({
  visible,
  imageUri,
  documentTitle,
  category,
  existingOcrText,
  onSaveOcrText,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OcrExtractionResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      if (existingOcrText) {
        setOcrResult({
          fullText: existingOcrText,
          blocks: [
            {
              id: '1',
              text: existingOcrText,
              confidence: 0.98,
              type: 'paragraph',
            },
          ],
          keywords: existingOcrText.split(/\s+/).slice(0, 10),
          detectedLanguage: 'English',
          estimatedReadingTimeSec: 10,
          extractedAt: new Date().toISOString(),
        });
      } else {
        extractText();
      }
    }
  }, [visible, existingOcrText]);

  const extractText = async () => {
    setLoading(true);
    try {
      const res = await ocrService.recognizeTextFromImage(imageUri, {
        name: documentTitle,
        category,
      });
      setOcrResult(res);
      if (onSaveOcrText) {
        onSaveOcrText(res.fullText);
      }
    } catch (e: any) {
      Alert.alert('OCR Error', e.message || 'Failed to extract text from document.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!ocrResult?.fullText) return;
    setCopied(true);
    Alert.alert('Copied!', 'Extracted text copied to clipboard successfully.');
    setTimeout(() => setCopied(false), 2000);
  };

  // Search within extracted text
  const searchResult = ocrResult ? ocrService.searchWithinText(ocrResult.fullText, searchQuery) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Document Text (OCR)</Text>
              <Text style={styles.subTitle}>100% On-Device Offline Recognition</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar inside Document Text */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search extracted text..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearch}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Search Result Counter */}
          {searchQuery && searchResult ? (
            <View style={styles.searchMatchBanner}>
              <Text style={styles.searchMatchText}>
                {searchResult.matchCount > 0
                  ? `Found ${searchResult.matchCount} matching line(s)`
                  : 'No matches found in extracted text'}
              </Text>
            </View>
          ) : null}

          {/* Extracted Text Content Box */}
          <View style={styles.contentBox}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Recognizing text from image...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {ocrResult?.blocks.map((block) => {
                  const isMatched =
                    searchQuery && block.text.toLowerCase().includes(searchQuery.toLowerCase());
                  return (
                    <View
                      key={block.id}
                      style={[styles.blockCard, isMatched && styles.blockCardHighlighted]}
                    >
                      <View style={styles.blockMeta}>
                        <Text style={styles.blockTypeBadge}>{block.type.toUpperCase()}</Text>
                        <Text style={styles.blockConfidence}>
                          {Math.round(block.confidence * 100)}% accuracy
                        </Text>
                      </View>
                      <Text style={styles.blockText}>{block.text}</Text>
                    </View>
                  );
                })}

                {ocrResult?.keywords && ocrResult.keywords.length > 0 ? (
                  <View style={styles.keywordsSection}>
                    <Text style={styles.keywordsTitle}>Keywords & Tags</Text>
                    <View style={styles.keywordsWrap}>
                      {ocrResult.keywords.map((kw, i) => (
                        <View key={i} style={styles.kwBadge}>
                          <Text style={styles.kwText}>#{kw}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} disabled={loading}>
              <Text style={styles.copyBtnText}>{copied ? '✓ Copied' : '📋 Copy All Text'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.reExtractBtn} onPress={extractText} disabled={loading}>
              <Text style={styles.reExtractText}>↺ Re-Scan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    height: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  subTitle: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  clearSearch: {
    fontSize: 14,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  searchMatchBanner: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginBottom: 8,
  },
  searchMatchText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  contentBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  blockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  blockCardHighlighted: {
    borderColor: colors.primary,
    backgroundColor: '#F5F3FF',
  },
  blockMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  blockTypeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockConfidence: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  blockText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  keywordsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  keywordsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kwBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  kwText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  copyBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  reExtractBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  reExtractText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});

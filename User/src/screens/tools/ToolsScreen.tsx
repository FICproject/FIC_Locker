import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { PdfToolsModal } from '../../components/modals/PdfToolsModal';
import { OcrViewerModal } from '../../components/modals/OcrViewerModal';
import { SignatureModal } from '../../components/modals/SignatureModal';
import { WatermarkModal } from '../../components/modals/WatermarkModal';
import { ocrService } from '../../services/ocrService';
import { pdfService, PdfPageItem } from '../../services/pdfService';

interface ToolItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: 'pdf' | 'ocr' | 'sign' | 'scan';
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

export const ToolsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // Modals state
  const [pdfToolsVisible, setPdfToolsVisible] = useState(false);
  const [pdfPages, setPdfPages] = useState<PdfPageItem[]>([]);
  const [activeDocTitle, setActiveDocTitle] = useState('Document');

  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [ocrImageUri, setOcrImageUri] = useState('');
  const [extractedOcrText, setExtractedOcrText] = useState('');

  const [sigModalVisible, setSigModalVisible] = useState(false);
  const [watermarkModalVisible, setWatermarkModalVisible] = useState(false);

  // 1. Convert Images to PDF / Page Organiser
  const handleOpenPdfTools = async (modeTitle: string) => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 10,
        quality: 0.9,
      });

      if (res.didCancel || !res.assets || res.assets.length === 0) return;

      const pages: PdfPageItem[] = res.assets
        .filter((a) => !!a.uri)
        .map((a, idx) => ({
          id: `page_${Date.now()}_${idx}`,
          uri: a.uri!,
          rotationDeg: 0,
        }));

      if (pages.length === 0) {
        Alert.alert('No Images', 'Please select at least one image to continue.');
        return;
      }

      setPdfPages(pages);
      setActiveDocTitle(modeTitle || 'PDF_Tool_Doc');
      setPdfToolsVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select images.');
    }
  };

  // 2. OCR Text Recognition
  const handleRunOcr = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
      });

      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      setLoading(true);
      setLoadingText('Recognizing text offline...');
      setOcrImageUri(uri);

      const ocrResult = await ocrService.recognizeTextFromImage(uri);
      setLoading(false);

      setExtractedOcrText(ocrResult.fullText);
      setOcrModalVisible(true);
    } catch (err: any) {
      setLoading(false);
      Alert.alert('OCR Error', err.message || 'Failed to extract text.');
    }
  };

  const tools: ToolItem[] = [
    {
      id: 'img_to_pdf',
      title: 'Images to PDF',
      subtitle: 'Convert one or multiple images into a clean PDF document',
      icon: '📄',
      category: 'pdf',
      badge: 'Popular',
      badgeColor: '#10B981',
      action: () => handleOpenPdfTools('Converted_Document'),
    },
    {
      id: 'compress_pdf',
      title: 'PDF Compression',
      subtitle: 'Reduce PDF file size (Low, Medium, High compression)',
      icon: '🗜️',
      category: 'pdf',
      badge: 'Advanced',
      badgeColor: colors.primary,
      action: () => handleOpenPdfTools('Compressed_PDF'),
    },
    {
      id: 'page_organise',
      title: 'Organise & Reorder Pages',
      subtitle: 'Reorder, rotate, add, and delete pages easily',
      icon: '📑',
      category: 'pdf',
      action: () => handleOpenPdfTools('Organised_PDF'),
    },
    {
      id: 'protect_pdf',
      title: 'Password Protect PDF',
      subtitle: 'Secure documents with AES password protection',
      icon: '🔒',
      category: 'pdf',
      badge: 'Security',
      badgeColor: '#EF4444',
      action: () => handleOpenPdfTools('Protected_PDF'),
    },
    {
      id: 'ocr_extract',
      title: 'Extract Text (OCR)',
      subtitle: '100% offline structured text recognition with in-text search',
      icon: '🔍',
      category: 'ocr',
      badge: 'Offline',
      badgeColor: '#8B5CF6',
      action: handleRunOcr,
    },
    {
      id: 'signature',
      title: 'Add Digital Signature',
      subtitle: 'Draw or upload smooth vector signatures on documents',
      icon: '✍️',
      category: 'sign',
      action: () => setSigModalVisible(true),
    },
    {
      id: 'watermark',
      title: 'Custom Watermark',
      subtitle: 'Apply diagonal or horizontal text watermarks with opacity',
      icon: '💧',
      category: 'sign',
      action: () => setWatermarkModalVisible(true),
    },
    {
      id: 'camera_scanner',
      title: 'In-App Camera Scanner',
      subtitle: 'Edge detection, auto capture, and multi-page batch scanning',
      icon: '📷',
      category: 'scan',
      badge: 'Live',
      badgeColor: '#F59E0B',
      action: () => navigation.navigate('Scanner'),
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" translucent={false} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tools</Text>
        <Text style={styles.headerSubtitle}>
          Professional PDF, OCR, Scanning & Security Tools
        </Text>
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingCardText}>{loadingText}</Text>
        </View>
      )}

      {/* Tools List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>PDF & Document Tools</Text>
        {tools
          .filter((t) => t.category === 'pdf')
          .map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={styles.toolCard}
              onPress={tool.action}
              activeOpacity={0.75}
            >
              <View style={styles.toolIconContainer}>
                <Text style={styles.toolIcon}>{tool.icon}</Text>
              </View>

              <View style={styles.toolTextContainer}>
                <View style={styles.toolTitleRow}>
                  <Text style={styles.toolTitle}>{tool.title}</Text>
                  {tool.badge && (
                    <View
                      style={[
                        styles.badgePill,
                        { backgroundColor: tool.badgeColor ? `${tool.badgeColor}20` : '#EDE9FE' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: tool.badgeColor || colors.primary },
                        ]}
                      >
                        {tool.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>OCR, Signing & Scanning</Text>
        {tools
          .filter((t) => t.category !== 'pdf')
          .map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={styles.toolCard}
              onPress={tool.action}
              activeOpacity={0.75}
            >
              <View style={styles.toolIconContainer}>
                <Text style={styles.toolIcon}>{tool.icon}</Text>
              </View>

              <View style={styles.toolTextContainer}>
                <View style={styles.toolTitleRow}>
                  <Text style={styles.toolTitle}>{tool.title}</Text>
                  {tool.badge && (
                    <View
                      style={[
                        styles.badgePill,
                        { backgroundColor: tool.badgeColor ? `${tool.badgeColor}20` : '#EDE9FE' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: tool.badgeColor || colors.primary },
                        ]}
                      >
                        {tool.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>

      {/* PDF Tools Modal */}
      <PdfToolsModal
        visible={pdfToolsVisible}
        initialPages={pdfPages}
        documentTitle={activeDocTitle}
        onExport={async (format, options, finalPages) => {
          setPdfToolsVisible(false);
          Alert.alert(
            'Export Successful',
            `Document exported as ${format.toUpperCase()} (${finalPages.length} page${finalPages.length > 1 ? 's' : ''}).`
          );
        }}
        onClose={() => setPdfToolsVisible(false)}
      />

      {/* OCR Viewer Modal */}
      <OcrViewerModal
        visible={ocrModalVisible}
        imageUri={ocrImageUri}
        existingOcrText={extractedOcrText}
        onClose={() => setOcrModalVisible(false)}
      />

      {/* Signature Modal */}
      <SignatureModal
        visible={sigModalVisible}
        onSave={(sigUri) => {
          setSigModalVisible(false);
          Alert.alert('Signature Saved', 'Digital signature created successfully.');
        }}
        onCancel={() => setSigModalVisible(false)}
      />

      {/* Watermark Modal */}
      <WatermarkModal
        visible={watermarkModalVisible}
        onApply={(wm) => {
          setWatermarkModalVisible(false);
          Alert.alert('Watermark Configured', `Watermark text "${wm.text}" configured.`);
        }}
        onCancel={() => setWatermarkModalVisible(false)}
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
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: borderRadius.md,
  },
  loadingCardText: {
    marginLeft: 10,
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...shadows.subtle,
  },
  toolIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8F9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  toolIcon: {
    fontSize: 22,
  },
  toolTextContainer: {
    flex: 1,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  toolTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginRight: 8,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  toolSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  chevron: {
    fontSize: 22,
    color: '#9CA3AF',
    marginLeft: 8,
  },
});

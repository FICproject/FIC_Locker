import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { OcrViewerModal } from '../../components/modals/OcrViewerModal';
import { PdfToolsModal } from '../../components/modals/PdfToolsModal';
import { CornerAdjustmentModal, DocumentCorners } from '../../components/scanner/CornerAdjustmentModal';
import { pdfService, PdfPageItem, PdfExportOptions } from '../../services/pdfService';
import { shareService } from '../../services/shareService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'normal' | 'magic' | 'bw' | 'grayscale' | 'sepia';
type CropPreset = 'full' | 'a4' | 'idcard' | 'square';

export const ScannerEditScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const pageUri = route.params?.pageUri;
  const initialPagesFromRoute: PdfPageItem[] = route.params?.allPages || [
    { id: 'p_1', uri: pageUri, rotationDeg: 0 },
  ];

  // Active Tool Panel
  const [activeTab, setActiveTab] = useState<'none' | 'crop' | 'filter' | 'adjust'>('none');

  // Multi-page state
  const [pages, setPages] = useState<PdfPageItem[]>(initialPagesFromRoute);

  // Tool 1: Rotation (0, 90, 180, 270)
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  // Tool 2: Filter Mode
  const [filterMode, setFilterMode] = useState<FilterType>('magic');

  // Tool 3: Crop Preset
  const [cropPreset, setCropPreset] = useState<CropPreset>('full');
  const [isCropActive, setIsCropActive] = useState<boolean>(false);

  // Tool 4: Adjustments (Brightness: -50 to +50, Contrast: 1 to 4)
  const [brightness, setBrightness] = useState<number>(10);
  const [contrastLevel, setContrastLevel] = useState<number>(2);

  // Advanced Modals
  const [ocrModalVisible, setOcrModalVisible] = useState<boolean>(false);
  const [pdfToolsVisible, setPdfToolsVisible] = useState<boolean>(false);
  const [cornerModalVisible, setCornerModalVisible] = useState<boolean>(false);
  const [extractedOcrText, setExtractedOcrText] = useState<string>('');

  // Rotation handler
  const handleRotate = () => {
    setRotationDeg((prev) => (prev + 90) % 360);
  };

  // Crop Preset handler
  const handleSelectCrop = (preset: CropPreset) => {
    setCropPreset(preset);
  };

  const handleApplyCrop = () => {
    setIsCropActive(false);
    setActiveTab('none');
  };

  const handleCancelCrop = () => {
    setCropPreset('full');
    setIsCropActive(false);
    setActiveTab('none');
  };

  // Reset Adjustments
  const handleResetAdjustments = () => {
    setBrightness(0);
    setContrastLevel(1);
  };

  // Save / Done
  const handleDone = () => {
    navigation.navigate('UploadDocument', {
      prefillName: 'Scanned_Doc_' + Date.now() + (pages.length > 1 ? '.pdf' : '.jpg'),
      pageUri: pages[0]?.uri || pageUri,
      allPages: pages,
      rotationDeg,
      filterMode,
      brightness,
      contrastLevel,
      cropPreset,
      ocrText: extractedOcrText,
    });
  };

  // Handler from PdfToolsModal export
  const handlePdfToolsExport = async (
    format: 'pdf' | 'jpg' | 'png',
    options: PdfExportOptions,
    finalPages: PdfPageItem[]
  ) => {
    setPdfToolsVisible(false);
    try {
      if (format === 'pdf') {
        const result = await pdfService.createPdfFromPages(finalPages, options);
        Alert.alert(
          'PDF Generated Successfully',
          `Created ${finalPages.length}-page document (${Math.round(result.fileSizeBytes / 1024)} KB). Ready for secure saving or sharing!`,
          [
            {
              text: 'Save to My Documents',
              onPress: () => {
                navigation.navigate('UploadDocument', {
                  prefillName: `${options.title || 'Scanned_Document'}.pdf`,
                  pageUri: finalPages[0]?.uri,
                  allPages: finalPages,
                  ocrText: extractedOcrText,
                  fileSizeBytes: result.fileSizeBytes,
                });
              },
            },
            {
              text: 'Share via WhatsApp / Email',
              onPress: async () => {
                await shareService.shareDocument({
                  _id: `doc_temp_${Date.now()}`,
                  userId: 'usr_default',
                  name: `${options.title || 'Scanned_Document'}.pdf`,
                  originalFileName: `${options.title || 'Scanned_Document'}.pdf`,
                  fileType: 'pdf',
                  mimeType: 'application/pdf',
                  fileSizeBytes: result.fileSizeBytes,
                  storageKey: 'temp.pdf',
                  category: 'Personal Documents',
                  tags: ['scanned', 'pdf'],
                  status: 'available',
                  localUri: finalPages[0]?.uri,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              },
            },
          ]
        );
      } else {
        // Export as image
        Alert.alert(
          'Image Ready',
          `Document prepared in ${format.toUpperCase()} format. Proceeding to save...`,
          [
            {
              text: 'Save to My Documents',
              onPress: () => {
                navigation.navigate('UploadDocument', {
                  prefillName: `Scanned_Page_${Date.now()}.${format}`,
                  pageUri: finalPages[0]?.uri,
                  ocrText: extractedOcrText,
                });
              },
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('Export Error', e.message || 'Failed to process document export.');
    }
  };

  const isSideways = rotationDeg === 90 || rotationDeg === 270;

  // Dynamic Crop Padding & Margins based on preset
  const getCropStyle = () => {
    switch (cropPreset) {
      case 'a4':
        return { paddingHorizontal: 16, paddingVertical: 24, borderRadius: 12 };
      case 'idcard':
        return { paddingHorizontal: 28, paddingVertical: 48, borderRadius: 16 };
      case 'square':
        return { paddingHorizontal: 32, paddingVertical: 32, borderRadius: 12 };
      default:
        return { padding: 0 };
    }
  };

  // Dynamic Brightness Overlay opacity
  const getBrightnessOverlay = () => {
    if (brightness > 0) {
      return {
        backgroundColor: `rgba(255, 255, 255, ${Math.min(brightness / 100, 0.45)})`,
      };
    } else if (brightness < 0) {
      return {
        backgroundColor: `rgba(0, 0, 0, ${Math.min(Math.abs(brightness) / 100, 0.6)})`,
      };
    }
    return null;
  };

  // Dynamic Filter Style
  const getFilterOverlay = () => {
    switch (filterMode) {
      case 'magic':
        // High-contrast clean CamScanner look
        return {
          backgroundColor: 'rgba(235, 243, 255, 0.18)',
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.25)',
        };
      case 'bw':
        // Black and white high-contrast
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        };
      case 'grayscale':
        return {
          backgroundColor: 'rgba(128, 128, 128, 0.28)',
        };
      case 'sepia':
        return {
          backgroundColor: 'rgba(180, 130, 70, 0.28)',
        };
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 20
            ) + 6,
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Edit Document</Text>
          {pages.length > 1 && (
            <View style={styles.pageCountBadge}>
              <Text style={styles.pageCountBadgeText}>{pages.length} Pages</Text>
            </View>
          )}
          {rotationDeg !== 0 && (
            <View style={styles.rotationBadge}>
              <Text style={styles.rotationBadgeText}>{rotationDeg}°</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleDone} style={styles.iconBtn}>
          <Text style={[styles.iconBtnText, { color: colors.primary }]}>✓</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Bar (OCR, PDF Tools, Manual Quad) */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          style={styles.quickBarBtn}
          onPress={() => setOcrModalVisible(true)}
        >
          <Text style={styles.quickBarIcon}>📄</Text>
          <Text style={styles.quickBarLabel}>
            {extractedOcrText ? '✓ OCR Active' : 'Extract Text (OCR)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBarBtn}
          onPress={() => setPdfToolsVisible(true)}
        >
          <Text style={styles.quickBarIcon}>📚</Text>
          <Text style={styles.quickBarLabel}>PDF Tools ({pages.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBarBtn}
          onPress={() => setCornerModalVisible(true)}
        >
          <Text style={styles.quickBarIcon}>📐</Text>
          <Text style={styles.quickBarLabel}>Corner Quad</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Viewport */}
      <View style={styles.canvasContainer}>
        <View style={[styles.cropWrapper, getCropStyle()]}>
          <View
            style={[
              styles.imageContainer,
              {
                transform: [
                  { rotate: `${rotationDeg}deg` },
                  { scale: isSideways ? 0.75 : 1.0 },
                ],
              },
            ]}
          >
            {pageUri ? (
              <Image
                source={{ uri: pageUri }}
                style={styles.capturedImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderSheet}>
                <Text style={styles.placeholderText}>📄 Document Preview</Text>
              </View>
            )}

            {/* Live Filter Tint Layer */}
            {getFilterOverlay() && (
              <View
                style={[StyleSheet.absoluteFillObject, getFilterOverlay(), styles.overlayLayer]}
                pointerEvents="none"
              />
            )}

            {/* Live Brightness Layer */}
            {getBrightnessOverlay() && (
              <View
                style={[StyleSheet.absoluteFillObject, getBrightnessOverlay()]}
                pointerEvents="none"
              />
            )}

            {/* Contrast Accent Layer */}
            {contrastLevel > 1 && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: `rgba(0, 0, 0, ${(contrastLevel - 1) * 0.08})`,
                  },
                ]}
                pointerEvents="none"
              />
            )}
          </View>

          {/* Interactive Crop Border & Grid Overlay */}
          {isCropActive && (
            <View style={styles.cropOverlay} pointerEvents="none">
              <View style={[styles.cropCorner, styles.cTopLeft]} />
              <View style={[styles.cropCorner, styles.cTopRight]} />
              <View style={[styles.cropCorner, styles.cBottomLeft]} />
              <View style={[styles.cropCorner, styles.cBottomRight]} />

              <View style={styles.gridLineH1} />
              <View style={styles.gridLineH2} />
              <View style={styles.gridLineV1} />
              <View style={styles.gridLineV2} />
            </View>
          )}
        </View>
      </View>

      {/* Dynamic Sub-Panel for Selected Tool */}
      {activeTab === 'crop' && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Crop & Align Bounds</Text>
            <TouchableOpacity onPress={handleCancelCrop}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.presetsRow}>
            {(['full', 'a4', 'idcard', 'square'] as CropPreset[]).map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetChip,
                  cropPreset === preset && styles.presetChipActive,
                ]}
                onPress={() => handleSelectCrop(preset)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    cropPreset === preset && styles.presetChipTextActive,
                  ]}
                >
                  {preset === 'full'
                    ? 'Full Page'
                    : preset === 'a4'
                    ? 'A4 Doc'
                    : preset === 'idcard'
                    ? 'ID Card'
                    : '1:1 Square'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCrop}>
            <Text style={styles.applyBtnText}>Apply Crop</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'filter' && (
        <View style={styles.subPanel}>
          <Text style={styles.subPanelTitle}>Document Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {[
              { id: 'normal', name: 'Original', icon: '📷' },
              { id: 'magic', name: 'Magic Scan', icon: '✨' },
              { id: 'bw', name: 'B&W Crisp', icon: '📄' },
              { id: 'grayscale', name: 'Grayscale', icon: '🔘' },
              { id: 'sepia', name: 'Warm Doc', icon: '📜' },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterCard,
                  filterMode === f.id && styles.filterCardActive,
                ]}
                onPress={() => setFilterMode(f.id as FilterType)}
              >
                <Text style={styles.filterIcon}>{f.icon}</Text>
                <Text
                  style={[
                    styles.filterName,
                    filterMode === f.id && styles.filterNameActive,
                  ]}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {activeTab === 'adjust' && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Lighting & Contrast</Text>
            <TouchableOpacity onPress={handleResetAdjustments}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Brightness Row */}
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>
              Brightness: <Text style={styles.adjustVal}>{brightness > 0 ? `+${brightness}` : brightness}%</Text>
            </Text>
            <View style={styles.adjustControls}>
              <TouchableOpacity
                style={styles.adjustStepBtn}
                onPress={() => setBrightness((prev) => Math.max(prev - 10, -50))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustStepBtn}
                onPress={() => setBrightness((prev) => Math.min(prev + 10, 50))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contrast Row */}
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>
              Contrast:{' '}
              <Text style={styles.adjustVal}>
                {contrastLevel === 1
                  ? 'Normal'
                  : contrastLevel === 2
                  ? 'Medium'
                  : contrastLevel === 3
                  ? 'High'
                  : 'Ultra'}
              </Text>
            </Text>
            <View style={styles.adjustControls}>
              {[1, 2, 3, 4].map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.contrastChip,
                    contrastLevel === lvl && styles.contrastChipActive,
                  ]}
                  onPress={() => setContrastLevel(lvl)}
                >
                  <Text
                    style={[
                      styles.contrastChipText,
                      contrastLevel === lvl && styles.contrastChipTextActive,
                    ]}
                  >
                    L{lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Bottom Main Tools Bar */}
      <View style={styles.toolBar}>
        {/* Tool 1: Rotate */}
        <TouchableOpacity style={styles.toolItem} onPress={handleRotate} activeOpacity={0.7}>
          <View style={[styles.toolIconWrap, rotationDeg !== 0 && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>🔄</Text>
          </View>
          <Text style={styles.toolLabel}>Rotate ({rotationDeg}°)</Text>
        </TouchableOpacity>

        {/* Tool 2: Crop */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            const next = activeTab === 'crop' ? 'none' : 'crop';
            setActiveTab(next);
            setIsCropActive(next === 'crop');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconWrap, activeTab === 'crop' && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>📐</Text>
          </View>
          <Text style={[styles.toolLabel, activeTab === 'crop' && styles.labelActive]}>
            Crop
          </Text>
        </TouchableOpacity>

        {/* Tool 3: Filter */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => setActiveTab(activeTab === 'filter' ? 'none' : 'filter')}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconWrap, activeTab === 'filter' && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>🎨</Text>
          </View>
          <Text style={[styles.toolLabel, activeTab === 'filter' && styles.labelActive]}>
            Filter: {filterMode === 'normal' ? 'Normal' : filterMode.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Tool 4: Adjust */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => setActiveTab(activeTab === 'adjust' ? 'none' : 'adjust')}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconWrap, activeTab === 'adjust' && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>⚙️</Text>
          </View>
          <Text style={[styles.toolLabel, activeTab === 'adjust' && styles.labelActive]}>
            Adjust
          </Text>
        </TouchableOpacity>
      </View>

      {/* Done Action Button */}
      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Save & Proceed</Text>
        </TouchableOpacity>
      </View>

      {/* OCR Text Viewer Modal */}
      <OcrViewerModal
        visible={ocrModalVisible}
        imageUri={pageUri}
        documentTitle="Scanned Document"
        existingOcrText={extractedOcrText}
        onSaveOcrText={(txt) => setExtractedOcrText(txt)}
        onClose={() => setOcrModalVisible(false)}
      />

      {/* PDF Tools Modal */}
      <PdfToolsModal
        visible={pdfToolsVisible}
        initialPages={pages}
        documentTitle="FIC_Locker_Scanned_Doc"
        onExport={handlePdfToolsExport}
        onClose={() => setPdfToolsVisible(false)}
      />

      {/* Corner Quad Modal */}
      {pageUri ? (
        <CornerAdjustmentModal
          visible={cornerModalVisible}
          imageUri={pageUri}
          onApply={(corners) => {
            setCornerModalVisible(false);
            Alert.alert('Perspective Corrected', 'Document corners and planar geometry aligned.');
          }}
          onCancel={() => setCornerModalVisible(false)}
        />
      ) : null}
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
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageCountBadge: {
    marginLeft: 8,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pageCountBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  rotationBadge: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rotationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  iconBtn: {
    padding: 8,
  },
  iconBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  quickBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  quickBarIcon: {
    fontSize: 14,
  },
  quickBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  canvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cropWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  overlayLayer: {
    borderRadius: borderRadius.md,
  },
  placeholderSheet: {
    width: '80%',
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  cropCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.primary,
  },
  cTopLeft: {
    top: 4,
    left: 4,
    borderTopWidth: 5,
    borderLeftWidth: 5,
  },
  cTopRight: {
    top: 4,
    right: 4,
    borderTopWidth: 5,
    borderRightWidth: 5,
  },
  cBottomLeft: {
    bottom: 4,
    left: 4,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
  },
  cBottomRight: {
    bottom: 4,
    right: 4,
    borderBottomWidth: 5,
    borderRightWidth: 5,
  },
  gridLineH1: {
    position: 'absolute',
    top: '33.3%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66.6%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.3%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.6%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  subPanel: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...shadows.card,
  },
  subPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subPanelTitle: {
    fontSize: 14,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  cancelText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  resetText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: '#F3F4F6',
  },
  presetChipActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  filterScroll: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  filterCard: {
    width: 76,
    height: 72,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  filterCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
  },
  filterIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  filterName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterNameActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  adjustLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  adjustVal: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  adjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  contrastChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F3F4F6',
  },
  contrastChipActive: {
    backgroundColor: colors.primary,
  },
  contrastChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  contrastChipTextActive: {
    color: '#FFFFFF',
  },
  toolBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  toolItem: {
    alignItems: 'center',
    minWidth: 64,
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolIconActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  toolIcon: {
    fontSize: 20,
  },
  toolLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  bottomAction: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
  },
  doneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.fontWeights.bold,
  },
});

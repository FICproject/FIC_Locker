import React, { useState, useRef, useEffect } from 'react';
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
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { OcrViewerModal } from '../../components/modals/OcrViewerModal';
import { PdfToolsModal } from '../../components/modals/PdfToolsModal';
import { CornerAdjustmentModal, DocumentCorners } from '../../components/scanner/CornerAdjustmentModal';
import { pdfService, PdfPageItem, PdfExportOptions } from '../../services/pdfService';
import { shareService } from '../../services/shareService';
import { documentService } from '../../services/api/documentService';
import { useAuth } from '../../context/AuthContext';
import { CategoryItem } from '../../types';
import { categoryService, getCategoryEmoji } from '../../services/api/categoryService';
import { DEFAULT_CATEGORIES } from '../../constants';
import { deduplicateDocuments } from '../../utils/documentUtils';
import {
  PaperSize,
  PAPER_SPECS,
  documentAnalysisService,
} from '../../services/documentAnalysisService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'normal' | 'magic' | 'bw' | 'grayscale' | 'sepia';
type CropPreset = 'full' | 'a4' | 'a3' | 'a5' | 'letter' | 'idcard' | 'square';

export const ScannerEditScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const pageUri = route.params?.pageUri;
  const initialPagesFromRoute: PdfPageItem[] = (route.params?.allPages && route.params.allPages.length > 0)
    ? route.params.allPages.map((p: any, idx: number) => ({
        id: p.id || `p_${idx + 1}`,
        uri: p.uri || p.originalUri || pageUri,
        rotationDeg: p.rotationDeg || 0,
        filterMode: p.filterMode,
        aspectRatio: p.aspectRatio,
        paperSize: p.paperSize,
        paperDimensions: p.paperDimensions,
      }))
    : pageUri
    ? [{ id: 'p_1', uri: pageUri, rotationDeg: 0 }]
    : [];

  // Paper Size & Dimensions from Auto-Analysis
  const [currentPaperSize, setCurrentPaperSize] = useState<PaperSize>(
    (route.params?.paperSize as PaperSize) || 'A4'
  );

  // Active Tool Panel
  const [activeTab, setActiveTab] = useState<'none' | 'crop' | 'filter' | 'adjust'>('none');

  // Multi-page state & scroll reference
  const [pages, setPages] = useState<PdfPageItem[]>(initialPagesFromRoute);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const scrollRef = useRef<ScrollView>(null);

  // Synchronize pages if route params update
  useEffect(() => {
    if (route.params?.allPages && route.params.allPages.length > 0) {
      setPages(
        route.params.allPages.map((p: any, idx: number) => ({
          id: p.id || `p_${idx + 1}`,
          uri: p.uri || p.originalUri || pageUri,
          rotationDeg: p.rotationDeg || 0,
          filterMode: p.filterMode,
          aspectRatio: p.aspectRatio,
          paperSize: p.paperSize,
          paperDimensions: p.paperDimensions,
        }))
      );
    }
  }, [route.params?.allPages, pageUri]);

  // Navigate to specific page in horizontal scroll view
  const goToPage = (index: number) => {
    if (index >= 0 && index < pages.length) {
      scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
      setCurrentPageIndex(index);
    }
  };

  // Track page index on momentum scroll end
  const handleScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < pages.length && index !== currentPageIndex) {
      setCurrentPageIndex(index);
    }
  };

  // Tool 1: Rotation for currently active page
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  const handleRotateCurrentPage = () => {
    setPages((prev) => {
      const updated = [...prev];
      if (updated[currentPageIndex]) {
        const curRot = (updated[currentPageIndex].rotationDeg || 0) + 90;
        updated[currentPageIndex] = {
          ...updated[currentPageIndex],
          rotationDeg: curRot % 360,
        };
      }
      return updated;
    });
  };

  const handleRotate = () => {
    handleRotateCurrentPage();
  };

  // Tool 2: Filter Mode
  const [filterMode, setFilterMode] = useState<FilterType>('magic');

  // Tool 3: Crop Preset
  const [cropPreset, setCropPreset] = useState<CropPreset>('a4');
  const [isCropActive, setIsCropActive] = useState<boolean>(false);

  // Tool 4: Adjustments (Brightness: -50 to +50, Contrast: 1 to 4)
  const [brightness, setBrightness] = useState<number>(10);
  const [contrastLevel, setContrastLevel] = useState<number>(2);

  // Advanced Modals
  const [ocrModalVisible, setOcrModalVisible] = useState<boolean>(false);
  const [pdfToolsVisible, setPdfToolsVisible] = useState<boolean>(false);
  const [cornerModalVisible, setCornerModalVisible] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedOcrText, setExtractedOcrText] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>(
    'DocScanner_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + Date.now().toString().slice(-4)
  );

  // Category selection for saving
  const [chosenCategory, setChosenCategory] = useState<string>('Personal Documents');
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(() =>
    DEFAULT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    }))
  );

  useEffect(() => {
    categoryService.getCachedCategories().then((cached) => {
      if (cached && cached.length > 0) setCategoriesList(cached);
    });
    categoryService.fetchCategories().then((cats) => {
      if (cats && cats.length > 0) setCategoriesList(cats);
    });
  }, []);

  // Auto-Crop / Remove Background for current page
  const handleAutoCropCurrentPage = async () => {
    const currentUri = pages[currentPageIndex]?.uri || pageUri;
    if (!currentUri) return;
    setIsProcessing(true);
    try {
      const res = await documentAnalysisService.analyzeAndCrop(currentUri, null, currentPaperSize);
      if (res.croppedUri) {
        setPages((prev) => {
          const updated = [...prev];
          updated[currentPageIndex] = {
            ...updated[currentPageIndex],
            uri: res.croppedUri,
          };
          return updated;
        });
      }
    } catch {
      setCornerModalVisible(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Doc Scanner Image 6: Open PDF
  const handleOpenPdf = async () => {
    try {
      const result = await pdfService.createPdfFromPages(pages, {
        title: docTitle,
        pageSize: currentPaperSize,
      });
      if (result.fileUri) {
        Alert.alert(
          'PDF Document Ready',
          `"${docTitle}.pdf" (${Math.round(result.fileSizeBytes / 1024)} KB, ${pages.length} pages).`,
          [
            {
              text: 'View PDF Tools',
              onPress: () => setPdfToolsVisible(true),
            },
            {
              text: 'Share PDF',
              onPress: () =>
                shareService.shareDocumentFile(
                  result.fileUri!,
                  'application/pdf',
                  `${docTitle}.pdf`
                ),
            },
            { text: 'OK' },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Failed to generate PDF.');
    }
  };

  // Doc Scanner Image 6: Share Document File (Real Attached PDF)
  const handleShareDoc = async () => {
    try {
      const result = await pdfService.createPdfFromPages(pages, {
        title: docTitle,
        pageSize: currentPaperSize,
      });
      const fileToShare = result.fileUri || pages[0]?.uri;
      if (fileToShare) {
        await shareService.shareDocumentFile(
          fileToShare,
          result.fileUri ? 'application/pdf' : 'image/jpeg',
          `${docTitle}.pdf`
        );
      }
    } catch (e: any) {
      Alert.alert('Share Error', e.message || 'Failed to share document.');
    }
  };

  // Doc Scanner: Open Category & Save Modal
  const handleSaveToMyDocs = () => {
    setSaveModalVisible(true);
  };

  // Perform actual document save with chosen category
  const executeSaveDocument = async (targetCategory: string) => {
    setIsSaving(true);
    try {
      const result = await pdfService.createPdfFromPages(pages, {
        title: docTitle,
        pageSize: currentPaperSize,
      });

      let serverDocId: string | null = null;
      let serverStorageKey = result.fileUri || 'offline_pdf';

      // Immediate attempt to upload to backend server with target category
      try {
        const authRes = await documentService.requestUploadAuth({
          fileName: `${docTitle}.pdf`,
          fileSizeBytes: result.fileSizeBytes || 1572864,
          mimeType: 'application/pdf',
          category: targetCategory,
          tags: ['scanned', currentPaperSize.toLowerCase(), 'doc_scanner'],
        });
        if (authRes?.documentId) {
          serverDocId = authRes.documentId;
          serverStorageKey = authRes.storageKey || serverStorageKey;
          try {
            await documentService.confirmUpload(authRes.documentId, {
              storageKey: serverStorageKey,
            });
          } catch {}
        }
      } catch (uploadErr) {
        console.warn('[ScannerEditScreen] Direct upload fallback to offline queue:', uploadErr);
      }

      const newOfflineDoc = {
        _id: serverDocId || `doc_scan_${Date.now()}`,
        userId: user?._id || '',
        name: `${docTitle}.pdf`,
        originalFileName: `${docTitle}.pdf`,
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: result.fileSizeBytes,
        storageKey: serverStorageKey,
        category: targetCategory,
        tags: ['scanned', currentPaperSize.toLowerCase(), 'doc_scanner'],
        status: 'available',
        localUri: result.fileUri || pages[0]?.uri,
        thumbnailUrl: pages[0]?.uri || result.fileUri,
        pageCount: pages.length || 1,
        pages: pages.map((p) => p.uri).filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingRaw = await AsyncStorage.getItem('@fic_locker_offline_docs');
      const existingDocs = existingRaw ? JSON.parse(existingRaw) : [];
      const cleanDocs = deduplicateDocuments([newOfflineDoc, ...existingDocs]);
      await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(cleanDocs));

      if (!serverDocId) {
        try {
          await documentService.syncOfflineDocuments();
        } catch (err) {}
      }

      setSaveModalVisible(false);

      Alert.alert(
        'Document Saved',
        `"${docTitle}.pdf" (${pages.length} page${pages.length > 1 ? 's' : ''}) has been saved under "${targetCategory}".`,
        [
          {
            text: '📁 View in Category',
            onPress: () => {
              navigation.navigate('CategoryDetail', {
                category: targetCategory,
              });
            },
          },
          {
            text: 'My Docs',
            onPress: () => {
              navigation.navigate('MainTabs', {
                screen: 'DocumentsTab',
                params: { category: targetCategory },
              });
            },
          },
          { text: 'Done' },
        ]
      );
    } catch (e: any) {
      Alert.alert('Save Error', e.message || 'Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  // Crop Preset handler
  const handleSelectCrop = (preset: CropPreset) => {
    setCropPreset(preset);
    if (preset === 'a4') setCurrentPaperSize('A4');
    else if (preset === 'a3') setCurrentPaperSize('A3');
    else if (preset === 'a5') setCurrentPaperSize('A5');
    else if (preset === 'letter') setCurrentPaperSize('Letter');
    else if (preset === 'idcard') setCurrentPaperSize('ID');
  };

  const handleApplyCrop = () => {
    setIsCropActive(false);
    setActiveTab('none');
  };

  const handleCancelCrop = () => {
    setCropPreset('a4');
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
      allPages: pages.map((p) => ({ ...p, paperSize: currentPaperSize })),
      rotationDeg,
      filterMode,
      brightness,
      contrastLevel,
      cropPreset,
      paperSize: currentPaperSize,
      paperDimensions: PAPER_SPECS[currentPaperSize]?.dimensions || '210 × 297 mm',
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

  // Clean viewport: zero artificial margins so only the document image is shown
  const getCropStyle = () => {
    return { padding: 0 };
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
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={handleDone} style={styles.iconBtn}>
            <Text style={[styles.iconBtnText, { color: colors.primary }]}>✓</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas Viewport with Horizontal Paged Scroll */}
      <View style={styles.canvasContainer}>
        {pages.length === 0 ? (
          <View style={styles.placeholderSheet}>
            <Text style={styles.placeholderText}>📄 No document preview</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            decelerationRate="fast"
            style={styles.pageScrollView}
            contentContainerStyle={styles.pageScrollContent}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
          >
            {pages.map((page, index) => {
              const pageRotation = page.rotationDeg || 0;
              const isSideways = pageRotation === 90 || pageRotation === 270;
              return (
                <View
                  key={page.id || `page_${index}`}
                  style={[styles.pageSlide, { width: SCREEN_WIDTH }]}
                >
                  <View style={[styles.cropWrapper, getCropStyle()]}>
                    <View
                      style={[
                        styles.imageContainer,
                        {
                          transform: [
                            { rotate: `${pageRotation}deg` },
                            { scale: isSideways ? 0.75 : 1.0 },
                          ],
                        },
                      ]}
                    >
                      {page.uri ? (
                        <Image
                          source={{ uri: page.uri }}
                          style={styles.capturedImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.placeholderSheet}>
                          <Text style={styles.placeholderText}>📄 Page {index + 1}</Text>
                        </View>
                      )}

                      {/* Live Filter Tint Layer */}
                      {getFilterOverlay() && (
                        <View
                          style={[
                            StyleSheet.absoluteFillObject,
                            getFilterOverlay(),
                            styles.overlayLayer,
                          ]}
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
                    {isCropActive && currentPageIndex === index && (
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
              );
            })}
          </ScrollView>
        )}

        {/* Floating Pagination Strip for documents: Page X/Y */}
        {pages.length > 0 && (
          <View style={styles.paginationStrip}>
            {pages.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.arrowBtn,
                  currentPageIndex === 0 && styles.arrowBtnDisabled,
                ]}
                onPress={() => goToPage(currentPageIndex - 1)}
                disabled={currentPageIndex === 0}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.arrowBtnText,
                    currentPageIndex === 0 && styles.arrowBtnTextDisabled,
                  ]}
                >
                  ‹
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.paginationCenter}>
              <Text style={styles.paginationPageText}>
                Page {currentPageIndex + 1}/{pages.length}
              </Text>
              {pages.length > 1 && (
                <View style={styles.dotsRow}>
                  {pages.map((_, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => goToPage(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      style={[
                        styles.dot,
                        idx === currentPageIndex ? styles.dotActive : styles.dotInactive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>

            {pages.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.arrowBtn,
                  currentPageIndex === pages.length - 1 && styles.arrowBtnDisabled,
                ]}
                onPress={() => goToPage(currentPageIndex + 1)}
                disabled={currentPageIndex === pages.length - 1}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.arrowBtnText,
                    currentPageIndex === pages.length - 1 && styles.arrowBtnTextDisabled,
                  ]}
                >
                  ›
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isProcessing && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          </View>
        )}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
            {(['a4', 'a3', 'a5', 'letter', 'idcard', 'square', 'full'] as CropPreset[]).map((preset) => (
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
                    ? 'A4 (210×297)'
                    : preset === 'a3'
                    ? 'A3 (297×420)'
                    : preset === 'a5'
                    ? 'A5 (148×210)'
                    : preset === 'letter'
                    ? 'US Letter'
                    : preset === 'idcard'
                    ? 'ID Card'
                    : '1:1 Square'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

      {/* Doc Scanner Image 6 Bottom Navigation Bar: Back | Edit | Edit All | Open PDF | Share | Save */}
      <View style={[styles.docScannerBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* 1. Back */}
        <TouchableOpacity style={styles.dsBarItem} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.dsBarIcon}>←</Text>
          <Text style={styles.dsBarLabel}>Back</Text>
        </TouchableOpacity>

        {/* 2. Edit (Opens Crop & Border Adjustment Modal) */}
        <TouchableOpacity
          style={styles.dsBarItem}
          onPress={() => setCornerModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dsBarIcon}>✂️</Text>
          <Text style={styles.dsBarLabel}>Crop</Text>
        </TouchableOpacity>

        {/* 3. Edit All (Filters / Enhancements for all pages) */}
        <TouchableOpacity
          style={styles.dsBarItem}
          onPress={() => {
            const next = activeTab === 'filter' ? 'none' : 'filter';
            setActiveTab(next);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.dsBarIcon}>📄</Text>
          <Text style={styles.dsBarLabel}>Edit All</Text>
        </TouchableOpacity>

        {/* 4. Open PDF */}
        <TouchableOpacity style={styles.dsBarItem} onPress={handleOpenPdf} activeOpacity={0.7}>
          <Text style={styles.dsBarIcon}>📑</Text>
          <Text style={styles.dsBarLabel}>Open PDF</Text>
        </TouchableOpacity>

        {/* 5. Share (Attaches Real PDF Document File) */}
        <TouchableOpacity style={styles.dsBarItem} onPress={handleShareDoc} activeOpacity={0.7}>
          <Text style={styles.dsBarIcon}>🔗</Text>
          <Text style={styles.dsBarLabel}>Share</Text>
        </TouchableOpacity>

        {/* 6. Save (Saves directly to My Documents) */}
        <TouchableOpacity style={styles.dsBarItem} onPress={handleSaveToMyDocs} activeOpacity={0.7}>
          <Text style={styles.dsBarIcon}>💾</Text>
          <Text style={styles.dsBarLabel}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* OCR Text Viewer Modal */}
      <OcrViewerModal
        visible={ocrModalVisible}
        imageUri={pages[currentPageIndex]?.uri || pageUri}
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

      {/* Corner Quad Modal (Doc Scanner Image 4) */}
      {pages[currentPageIndex]?.uri || pageUri ? (
        <CornerAdjustmentModal
          visible={cornerModalVisible}
          imageUri={pages[currentPageIndex]?.uri || pageUri}
          documentTitle={docTitle}
          onApply={(corners, paperSize, croppedUri, filterName, newDocName) => {
            setCornerModalVisible(false);
            if (newDocName) setDocTitle(newDocName);
            if (paperSize) {
              setCurrentPaperSize(paperSize);
              setCropPreset(paperSize.toLowerCase() as CropPreset);
            }
            if (croppedUri) {
              setPages((prev) => {
                const updated = [...prev];
                updated[currentPageIndex] = {
                  ...updated[currentPageIndex],
                  uri: croppedUri,
                };
                return updated;
              });
            }
          }}
          onCancel={() => setCornerModalVisible(false)}
        />
      ) : null}

      {/* Save Document & Category Selection Modal */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.saveModalOverlay}>
          <View style={styles.saveModalCard}>
            <View style={styles.saveModalHeader}>
              <Text style={styles.saveModalTitle}>💾 Save Scanned Document</Text>
              <TouchableOpacity
                onPress={() => setSaveModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.saveModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.saveInputLabel}>Document Title</Text>
            <TextInput
              style={styles.saveTextInput}
              value={docTitle}
              onChangeText={setDocTitle}
              placeholder="Enter document name..."
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.saveInputLabel}>Select Category</Text>
            <ScrollView
              style={styles.categoryPickerList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {categoriesList.map((cat) => {
                const isSelected =
                  chosenCategory.trim().toLowerCase() === cat.name.trim().toLowerCase();
                const emoji = getCategoryEmoji(cat.name, cat.icon);
                return (
                  <TouchableOpacity
                    key={cat.id || cat._id || cat.name}
                    style={[
                      styles.categoryOptionItem,
                      isSelected && styles.categoryOptionItemSelected,
                    ]}
                    onPress={() => setChosenCategory(cat.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.catOptionLeft}>
                      <Text style={styles.catOptionEmoji}>{emoji}</Text>
                      <Text
                        style={[
                          styles.catOptionText,
                          isSelected && styles.catOptionTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.catCheckmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.saveModalFooter}>
              <TouchableOpacity
                style={styles.saveCancelBtn}
                onPress={() => setSaveModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.saveCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveConfirmBtn}
                onPress={() => executeSaveDocument(chosenCategory)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveConfirmBtnText}>Save to My Docs</Text>
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
  paperBadgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  paperBadgeTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  paperBadgeTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  paperBadgeTitle: {
    flex: 1,
    fontSize: 12,
    color: '#6B21A8',
    fontWeight: '600',
  },
  paperSwitchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  paperSwitchBtnText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerRotateBtn: {
    padding: 8,
  },
  headerRotateIcon: {
    fontSize: 18,
  },
  presetsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageScrollView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  pageScrollContent: {
    alignItems: 'center',
  },
  pageSlide: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  paginationStrip: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    gap: 12,
  },
  paginationCenter: {
    alignItems: 'center',
  },
  paginationPageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary || '#6366F1',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  arrowBtnDisabled: {
    opacity: 0.25,
  },
  arrowBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -2,
  },
  arrowBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  cropWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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
  // Doc Scanner Image 6 Bottom Navigation Bar
  docScannerBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  dsBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 54,
  },
  dsBarIcon: {
    fontSize: 22,
    color: '#374151',
    marginBottom: 3,
  },
  dsBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  saveModalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 22,
    ...shadows.card,
  },
  saveModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  saveModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  saveModalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
    padding: 4,
  },
  saveInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  saveTextInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  categoryPickerList: {
    maxHeight: 220,
    marginTop: 4,
  },
  categoryOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  categoryOptionItemSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  catOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catOptionEmoji: {
    fontSize: 20,
  },
  catOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  catOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  catCheckmark: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '800',
  },
  saveModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 14,
  },
  saveCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  saveCancelBtnText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  saveConfirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
  NativeModules,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { normalizeDocName } from '../../utils/documentUtils';
import { documentService } from '../../services/api/documentService';
import { shareService } from '../../services/shareService';
import { pdfService, PdfPageItem, PdfExportOptions } from '../../services/pdfService';
import { OcrViewerModal } from '../../components/modals/OcrViewerModal';
import { PdfToolsModal } from '../../components/modals/PdfToolsModal';
import { RenameDocumentModal } from '../../components/modals/RenameDocumentModal';
import { MoveDocumentModal } from '../../components/modals/MoveDocumentModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DocumentDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const initialDoc: DocumentItem = route.params?.document || {
    _id: 'doc_1',
    name: 'Document.jpg',
    originalFileName: 'Document.jpg',
    fileType: 'jpg',
    fileSizeBytes: 1572864,
    category: 'Personal Documents',
    tags: ['scan'],
    notes: '',
    pageCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const [doc, setDoc] = useState<DocumentItem>(initialDoc);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSavingGallery, setIsSavingGallery] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  // Horizontal paging scroll reference & measured layout width
  const scrollRef = useRef<ScrollView>(null);
  const [wrapperWidth, setWrapperWidth] = useState<number>(SCREEN_WIDTH - 64);

  // Modals
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [pdfToolsVisible, setPdfToolsVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  // Sync document pages and details from local offline cache and remote backend
  useEffect(() => {
    (async () => {
      // 1. Fetch latest details from backend if document has ID
      if (doc._id && !doc._id.startsWith('doc_local_')) {
        try {
          const remoteDoc = await documentService.getDocumentById(doc._id);
          if (remoteDoc) {
            setDoc((prev) => ({
              ...prev,
              ...remoteDoc,
              localUri: remoteDoc.localUri || remoteDoc.thumbnailUrl || remoteDoc.downloadUrl || prev.localUri,
              thumbnailUrl: remoteDoc.thumbnailUrl || remoteDoc.localUri || remoteDoc.downloadUrl || prev.thumbnailUrl,
              pages: (remoteDoc.pages && remoteDoc.pages.length > 0) ? remoteDoc.pages : prev.pages,
              pageCount: remoteDoc.pageCount || prev.pageCount,
            }));
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch remote document details:', fetchErr);
        }
      }

      // 2. Fetch cached offline details
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cached) {
          const list: DocumentItem[] = JSON.parse(cached);
          const found = list.find((d) => d._id === doc._id || d.name === doc.name);
          if (found) {
            setDoc((prev) => {
              const mergedPages = (found.pages && found.pages.length > 0) ? found.pages : prev.pages;
              const mergedCount = Math.max(
                found.pageCount || 1,
                mergedPages ? mergedPages.length : 1,
                prev.pageCount || 1
              );
              return {
                ...prev,
                localUri: prev.localUri || found.localUri || found.thumbnailUrl,
                thumbnailUrl: prev.thumbnailUrl || found.thumbnailUrl || found.localUri,
                pages: mergedPages,
                pageCount: mergedCount,
                ocrText: prev.ocrText || found.ocrText,
              };
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load cached doc pages:', err);
      }
    })();
  }, [doc._id, doc.name]);

  // Build page URIs list for horizontal paging & viewer
  const pageList: string[] = useMemo(() => {
    if (doc.pages && Array.isArray(doc.pages) && doc.pages.length > 0) {
      return doc.pages.filter(Boolean);
    }
    const baseUri = doc.localUri || doc.thumbnailUrl || doc.downloadUrl || '';
    if (!baseUri) return [];

    const count = Math.max(1, doc.pageCount || 1);
    if (count > 1) {
      return Array.from({ length: count }, (_, idx) => {
        if (doc.pages && doc.pages[idx]) return doc.pages[idx];
        return baseUri;
      });
    }

    return [baseUri];
  }, [doc.pages, doc.pageCount, doc.localUri, doc.thumbnailUrl, doc.downloadUrl]);

  const totalPages = Math.max(1, pageList.length, doc.pageCount || 1);
  const activeImageUri = pageList[currentPage - 1] || doc.localUri || doc.thumbnailUrl || doc.downloadUrl;

  // Build page array for PDF tools
  const pdfPages: PdfPageItem[] =
    pageList.length > 0
      ? pageList.map((uri, idx) => ({ id: `p_${idx + 1}`, uri, rotationDeg: 0 }))
      : [{ id: 'p_1', uri: activeImageUri || '', rotationDeg: 0 }];

  const goToPage = (targetPage: number) => {
    const pageNum = Math.min(totalPages, Math.max(1, targetPage));
    setCurrentPage(pageNum);
    scrollRef.current?.scrollTo({
      x: (pageNum - 1) * (wrapperWidth > 0 ? wrapperWidth : SCREEN_WIDTH - 64),
      animated: true,
    });
  };

  const handleScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const width = wrapperWidth > 0 ? wrapperWidth : SCREEN_WIDTH - 64;
    const pageIdx = Math.round(x / width);
    const newPage = Math.min(totalPages, Math.max(1, pageIdx + 1));
    setCurrentPage(newPage);
  };

  /**
   * Import Image: Save document image directly into device Gallery (Pictures/FIC_Locker)
   */
  const handleSaveToGallery = async () => {
    if (!activeImageUri) {
      Alert.alert('No Image Available', 'This document does not contain an image file to save.');
      return;
    }

    setIsSavingGallery(true);
    try {
      if (Platform.OS === 'android' && NativeModules.InAppCameraModule?.saveImageToGallery) {
        const pageSuffix = totalPages > 1 ? `_page_${currentPage}` : '';
        await NativeModules.InAppCameraModule.saveImageToGallery(
          activeImageUri,
          `${doc.name.replace(/\.[^/.]+$/, '')}${pageSuffix}`
        );
        Alert.alert(
          'Saved to Gallery',
          `"${doc.name.replace(/\.[^/.]+$/, '')}${pageSuffix}.jpg" has been saved directly to your phone's Gallery (Pictures/FIC_Locker).`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Gallery Save', 'Document image saved to device storage.');
      }
    } catch (err: any) {
      console.warn('saveImageToGallery error:', err);
      Alert.alert('Save Failed', err.message || 'Could not save image to Gallery.');
    } finally {
      setIsSavingGallery(false);
    }
  };

  /**
   * Share as PDF: Generate PDF (if needed) and open native share sheet
   */
  const handleShareAsPdf = async () => {
    setShareModalVisible(false);
    setIsSharingPdf(true);
    try {
      const cleanTitle = (doc.name || 'Document').replace(/\.[^/.]+$/, '').trim();
      const pdfFileName = `${cleanTitle}.pdf`;

      // If we have scanned pages/images, ALWAYS generate the native PDF embedding the real scanned photos
      if (pdfPages.length > 0 && pdfPages.some((p) => Boolean(p.uri))) {
        const result = await pdfService.createPdfFromPages(pdfPages, {
          title: cleanTitle,
        });
        if (result.fileUri) {
          await shareService.shareDocumentFile(result.fileUri, 'application/pdf', pdfFileName);
          return;
        }
      }

      // If document already points to a real local .pdf file
      if (doc.fileType === 'pdf' && doc.localUri && doc.localUri.toLowerCase().endsWith('.pdf')) {
        await shareService.shareDocumentFile(doc.localUri, 'application/pdf', doc.name);
        return;
      }

      // Fallback
      await shareService.shareDocument({
        ...doc,
        name: pdfFileName,
        fileType: 'pdf',
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to prepare PDF for sharing.');
    } finally {
      setIsSharingPdf(false);
    }
  };

  /**
   * Share as Image: Share image directly via native share sheet
   */
  const handleShareAsImage = async () => {
    setShareModalVisible(false);
    try {
      if (activeImageUri) {
        await shareService.shareDocumentFile(activeImageUri, 'image/jpeg', doc.name);
      } else {
        await shareService.shareDocument(doc);
      }
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share image.');
    }
  };

  /**
   * Share as Link: Share secure FIC Locker vault/download link
   */
  const handleShareLink = async () => {
    setShareModalVisible(false);
    try {
      await shareService.shareDocument(doc);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share link.');
    }
  };

  /**
   * Share via WhatsApp: Direct 1-tap WhatsApp sharing
   */
  const handleShareWhatsApp = async () => {
    setShareModalVisible(false);
    try {
      await shareService.shareToWhatsApp(doc);
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err.message || 'Could not open WhatsApp.');
    }
  };

  /**
   * Delete Document with confirmation dialog
   */
  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentService.deleteDocument(doc._id);
            } catch (e) {}

            // Remove from local cache as well (clean up any variant/duplicate of this doc)
            try {
              const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
              if (cached) {
                const list: DocumentItem[] = JSON.parse(cached);
                const normTarget = normalizeDocName(doc.name || doc.originalFileName || '');
                const updated = list.filter(
                  (d) =>
                    d._id !== doc._id &&
                    normalizeDocName(d.name || d.originalFileName || '') !== normTarget
                );
                await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
              }
            } catch {}

            navigation.goBack();
          },
        },
      ]
    );
  };

  /**
   * Handle PDF Tools export
   */
  const handlePdfToolsExport = async (
    format: 'pdf' | 'jpg' | 'png',
    options: PdfExportOptions,
    finalPages: PdfPageItem[]
  ) => {
    setPdfToolsVisible(false);
    try {
      if (format === 'pdf') {
        const result = await pdfService.createPdfFromPages(finalPages, options);
        const exportedTitle = options.title?.trim() || doc.name.replace(/\.[^/.]+$/, '');
        const exportedFileName = `${exportedTitle}.pdf`;
        Alert.alert(
          'PDF Export Complete',
          `Successfully generated ${finalPages.length}-page PDF "${exportedFileName}" (${Math.round(result.fileSizeBytes / 1024)} KB).`,
          [
            {
              text: 'Share PDF',
              onPress: () => {
                if (result.fileUri) {
                  shareService.shareDocumentFile(result.fileUri, 'application/pdf', exportedFileName);
                } else {
                  shareService.shareDocument({
                    ...doc,
                    name: exportedFileName,
                    fileType: 'pdf',
                  });
                }
              },
            },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Export Complete', `Document exported as ${format.toUpperCase()}.`);
      }
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export document.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {doc.fileType === 'pdf' ? 'PDF Viewer' : 'Document Viewer'}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerOcrBtn}
            onPress={() => setOcrModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerOcrText}>
              {doc.ocrText ? '✓ OCR' : '📄 OCR'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Document Viewer Body with Horizontal Paging */}
      <View style={styles.viewerContainer}>
        <View style={styles.pageCard}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {doc.name.replace(/\.[^/.]+$/, '')}
          </Text>

          {pageList.length > 0 ? (
            <View
              style={styles.imageWrapper}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && Math.abs(w - wrapperWidth) > 1) {
                  setWrapperWidth(w);
                }
              }}
            >
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                decelerationRate="fast"
                onMomentumScrollEnd={handleScrollEnd}
                scrollEventThrottle={16}
                style={{ width: '100%', height: '100%' }}
                contentContainerStyle={{ alignItems: 'center' }}
              >
                {pageList.map((uri, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: wrapperWidth,
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.realPhoto}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : doc.fileType === 'pdf' ? (
            <View style={styles.pdfFallbackContainer}>
              <View style={styles.pdfBadge}>
                <Text style={styles.pdfBadgeText}>PDF DOCUMENT</Text>
              </View>
              <Text style={styles.pdfFileName} numberOfLines={2}>
                {doc.name}
              </Text>
              <Text style={styles.pdfMeta}>{formatBytes(doc.fileSizeBytes)}</Text>
              <View style={styles.mockTextLines}>
                <View style={styles.mockLine} />
                <View style={[styles.mockLine, { width: '85%' }]} />
                <View style={[styles.mockLine, { width: '90%' }]} />
                <View style={[styles.mockLine, { width: '70%' }]} />
              </View>
            </View>
          ) : (
            <View style={styles.noPhotoContainer}>
              <Text style={styles.noPhotoIcon}>📷</Text>
              <Text style={styles.noPhotoTitle}>{doc.name}</Text>
              <Text style={styles.noPhotoMeta}>
                {formatBytes(doc.fileSizeBytes)} • {formatDate(doc.createdAt)}
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterCategory}>{doc.category || 'Personal Documents'}</Text>
            <Text style={styles.cardFooterDate}>{formatDate(doc.createdAt)}</Text>
          </View>
        </View>

        {/* Paging Controls Pill */}
        <View style={styles.pagingContainer}>
          <TouchableOpacity
            onPress={() => goToPage(currentPage - 1)}
            style={[styles.pageBtn, (currentPage <= 1 || totalPages <= 1) && styles.pageBtnDisabled]}
            disabled={currentPage <= 1 || totalPages <= 1}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pageBtnText,
                (currentPage <= 1 || totalPages <= 1) && styles.pageBtnTextDisabled,
              ]}
            >
              ◀
            </Text>
          </TouchableOpacity>

          <Text style={styles.pageIndicator}>
            {currentPage} / {totalPages}
          </Text>

          <TouchableOpacity
            onPress={() => goToPage(currentPage + 1)}
            style={[
              styles.pageBtn,
              (currentPage >= totalPages || totalPages <= 1) && styles.pageBtnDisabled,
            ]}
            disabled={currentPage >= totalPages || totalPages <= 1}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pageBtnText,
                (currentPage >= totalPages || totalPages <= 1) && styles.pageBtnTextDisabled,
              ]}
            >
              ▶
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* New Fixed Bottom Action Bar */}
      <View style={styles.bottomActionBar}>
        {/* 1. PDF */}
        <TouchableOpacity
          style={styles.actionCol}
          onPress={() => setPdfToolsVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.actionEmoji}>📕</Text>
          </View>
          <Text style={styles.actionLabel}>PDF</Text>
        </TouchableOpacity>

        {/* 2. Import Image (Save to Gallery) */}
        <TouchableOpacity
          style={styles.actionCol}
          onPress={handleSaveToGallery}
          disabled={isSavingGallery}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#E0F2FE' }]}>
            {isSavingGallery ? (
              <ActivityIndicator size="small" color="#0284C7" />
            ) : (
              <Text style={styles.actionEmoji}>🖼️</Text>
            )}
          </View>
          <Text style={styles.actionLabel}>Import Image</Text>
        </TouchableOpacity>

        {/* 3. Share */}
        <TouchableOpacity
          style={styles.actionCol}
          onPress={() => setShareModalVisible(true)}
          disabled={isSharingPdf}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#EDE9FE' }]}>
            {isSharingPdf ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.actionEmoji}>↗️</Text>
            )}
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>

        {/* 4. Delete */}
        <TouchableOpacity
          style={styles.actionCol}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.actionEmoji}>🗑️</Text>
          </View>
          <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Modern Share Options Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.shareModalOverlay}
          activeOpacity={1}
          onPress={() => setShareModalVisible(false)}
        >
          <View style={styles.shareModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.shareModalHandle} />
            <Text style={styles.shareModalTitle}>Share Document</Text>
            <Text style={styles.shareModalSubtitle} numberOfLines={1}>
              {doc.name}
            </Text>

            {/* Option 1: Share as PDF */}
            <TouchableOpacity
              style={styles.shareOptionCard}
              onPress={handleShareAsPdf}
              activeOpacity={0.7}
            >
              <View style={[styles.shareOptionIconBox, { backgroundColor: '#FEE2E2' }]}>
                <Text style={styles.shareOptionEmoji}>📕</Text>
              </View>
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Share as PDF</Text>
                <Text style={styles.shareOptionSub}>Convert to formatted PDF document</Text>
              </View>
              <Text style={styles.shareOptionArrow}>›</Text>
            </TouchableOpacity>

            {/* Option 2: Share as Image */}
            <TouchableOpacity
              style={styles.shareOptionCard}
              onPress={handleShareAsImage}
              activeOpacity={0.7}
            >
              <View style={[styles.shareOptionIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Text style={styles.shareOptionEmoji}>🖼️</Text>
              </View>
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Share as Image</Text>
                <Text style={styles.shareOptionSub}>Share original JPG document photo</Text>
              </View>
              <Text style={styles.shareOptionArrow}>›</Text>
            </TouchableOpacity>

            {/* Option 3: Share Secure Link */}
            <TouchableOpacity
              style={styles.shareOptionCard}
              onPress={handleShareLink}
              activeOpacity={0.7}
            >
              <View style={[styles.shareOptionIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Text style={styles.shareOptionEmoji}>🔗</Text>
              </View>
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Share Secure Link</Text>
                <Text style={styles.shareOptionSub}>Encrypted FIC Locker vault link</Text>
              </View>
              <Text style={styles.shareOptionArrow}>›</Text>
            </TouchableOpacity>

            {/* Option 4: Share to WhatsApp */}
            <TouchableOpacity
              style={styles.shareOptionCard}
              onPress={handleShareWhatsApp}
              activeOpacity={0.7}
            >
              <View style={[styles.shareOptionIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Text style={styles.shareOptionEmoji}>💬</Text>
              </View>
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Share via WhatsApp</Text>
                <Text style={styles.shareOptionSub}>Direct 1-tap message sharing</Text>
              </View>
              <Text style={styles.shareOptionArrow}>›</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.shareCancelBtn}
              onPress={() => setShareModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.shareCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* OCR Viewer Modal */}
      <OcrViewerModal
        visible={ocrModalVisible}
        imageUri={activeImageUri || ''}
        documentTitle={doc.name}
        category={doc.category}
        existingOcrText={doc.ocrText}
        onSaveOcrText={async (txt) => {
          setDoc((prev) => ({ ...prev, ocrText: txt }));
          try {
            await documentService.updateOcrText(doc._id, txt);
          } catch {}
          try {
            const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
            if (cached) {
              const list: DocumentItem[] = JSON.parse(cached);
              const updated = list.map((d) => (d._id === doc._id ? { ...d, ocrText: txt } : d));
              await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
            }
          } catch {}
        }}
        onClose={() => setOcrModalVisible(false)}
      />

      {/* PDF Tools Modal */}
      <PdfToolsModal
        visible={pdfToolsVisible}
        initialPages={pdfPages}
        documentTitle={doc.name.replace(/\.[^/.]+$/, '')}
        onExport={handlePdfToolsExport}
        onClose={() => setPdfToolsVisible(false)}
      />

      {/* Rename Document Modal */}
      <RenameDocumentModal
        visible={renameModalVisible}
        document={doc}
        onSuccess={(updated) => setDoc(updated)}
        onClose={() => setRenameModalVisible(false)}
      />

      {/* Move Document Modal */}
      <MoveDocumentModal
        visible={moveModalVisible}
        document={doc}
        onSuccess={(updated) => setDoc(updated)}
        onClose={() => setMoveModalVisible(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    ...shadows.card,
  },
  backBtn: {
    padding: 8,
    marginRight: 6,
  },
  backArrow: {
    fontSize: 22,
    color: '#111827',
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerOcrBtn: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerOcrText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  viewerContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  pageCard: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.card,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  realPhoto: {
    width: '100%',
    height: '100%',
  },
  pdfFallbackContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pdfBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
  },
  pdfBadgeText: {
    color: colors.pdfRed,
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  pdfFileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  pdfMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  mockTextLines: {
    width: '90%',
    gap: 8,
    alignItems: 'center',
  },
  mockLine: {
    width: '100%',
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  noPhotoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noPhotoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  noPhotoMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardFooterCategory: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  cardFooterDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pagingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
  },
  pageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: 'bold',
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
  },
  bottomActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    ...shadows.card,
  },
  actionCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  shareModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  shareModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  shareModalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  shareOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8F9FE',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shareOptionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shareOptionEmoji: {
    fontSize: 20,
  },
  shareOptionInfo: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  shareOptionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  shareOptionArrow: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  shareCancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  shareCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
});

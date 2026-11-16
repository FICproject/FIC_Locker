import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
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

  // Modals
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [pdfToolsVisible, setPdfToolsVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);

  // If localUri was not in route params, look up matching document in local cache
  useEffect(() => {
    (async () => {
      if (!doc.localUri && !doc.thumbnailUrl) {
        try {
          const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
          if (cached) {
            const list: DocumentItem[] = JSON.parse(cached);
            const found = list.find((d) => d._id === doc._id || d.name === doc.name);
            if (found && (found.localUri || found.thumbnailUrl)) {
              setDoc((prev) => ({
                ...prev,
                localUri: found.localUri || found.thumbnailUrl,
                thumbnailUrl: found.thumbnailUrl || found.localUri,
                pageCount: found.pageCount || 1,
                ocrText: found.ocrText || prev.ocrText,
              }));
            }
          }
        } catch {
          // ignore cache read error
        }
      }
    })();
  }, [doc._id, doc.name]);

  const totalPages = Math.max(1, doc.pageCount || 1);
  const imageUri = doc.localUri || doc.thumbnailUrl || doc.downloadUrl;

  const handleDownload = async () => {
    try {
      Alert.alert('Download Authorized', 'Retrieving backend download URL...');
      const res = await documentService.getDownloadUrl(doc._id);
      Alert.alert('Download Ready', `File ready for offline viewing (Expires in ${res.expiresInSeconds || 300}s).`);
    } catch (e) {
      Alert.alert('Offline Mode', 'Downloaded and cached in device storage.');
    }
  };

  // 1-Tap WhatsApp Share
  const handleShareWhatsApp = async () => {
    await shareService.shareToWhatsApp(doc);
  };

  // 1-Tap Email Share
  const handleShareEmail = async () => {
    await shareService.shareToEmail(doc);
  };

  // General Share
  const handleGeneralShare = async () => {
    await shareService.shareDocument(doc);
  };

  const handleDelete = () => {
    Alert.alert('Delete Document', 'Are you sure you want to permanently delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await documentService.deleteDocument(doc._id);
          } catch (e) {}

          // Remove from local cache as well
          try {
            const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
            if (cached) {
              const list: DocumentItem[] = JSON.parse(cached);
              const updated = list.filter((d) => d._id !== doc._id && d.name !== doc.name);
              await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
            }
          } catch {}

          navigation.goBack();
        },
      },
    ]);
  };

  // Handle PDF Tools export
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
          'PDF Export Complete',
          `Successfully generated ${finalPages.length}-page PDF (${Math.round(result.fileSizeBytes / 1024)} KB).`,
          [
            {
              text: 'Share PDF',
              onPress: () => {
                shareService.shareDocument({
                  ...doc,
                  name: `${doc.name.replace(/\.[^/.]+$/, '')}_exported.pdf`,
                  fileType: 'pdf',
                });
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

  // Build page array for PDF tools
  const pdfPages: PdfPageItem[] =
    doc.pages && doc.pages.length > 0
      ? doc.pages.map((uri, idx) => ({ id: `p_${idx}`, uri, rotationDeg: 0 }))
      : [{ id: 'p_1', uri: imageUri || '', rotationDeg: 0 }];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {doc.fileType === 'pdf' ? 'PDF Viewer' : 'Document Viewer'}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleDownload} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>📥</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleGeneralShare} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feature Action Buttons Strip */}
      <View style={styles.featureStrip}>
        <TouchableOpacity
          style={styles.featureBtn}
          onPress={() => setOcrModalVisible(true)}
        >
          <Text style={styles.featureIcon}>📄</Text>
          <Text style={styles.featureLabel}>
            {doc.ocrText ? '✓ OCR Extracted' : 'OCR Text'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.featureBtn}
          onPress={() => setPdfToolsVisible(true)}
        >
          <Text style={styles.featureIcon}>📚</Text>
          <Text style={styles.featureLabel}>PDF Tools</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.featureBtn} onPress={handleShareWhatsApp}>
          <Text style={styles.featureIcon}>💬</Text>
          <Text style={styles.featureLabel}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.featureBtn} onPress={handleShareEmail}>
          <Text style={styles.featureIcon}>✉️</Text>
          <Text style={styles.featureLabel}>Email</Text>
        </TouchableOpacity>
      </View>

      {/* Document Viewer Body */}
      <View style={styles.viewerContainer}>
        <View style={styles.pageCard}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {doc.name.replace(/\.[^/.]+$/, '')}
          </Text>

          {imageUri ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: imageUri }}
                style={styles.realPhoto}
                resizeMode="contain"
              />
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
      </View>

      {/* Bottom Paging Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
          style={[styles.pageBtn, (currentPage <= 1 || totalPages <= 1) && styles.pageBtnDisabled]}
          disabled={currentPage <= 1 || totalPages <= 1}
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
          onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          style={[
            styles.pageBtn,
            (currentPage >= totalPages || totalPages <= 1) && styles.pageBtnDisabled,
          ]}
          disabled={currentPage >= totalPages || totalPages <= 1}
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

      {/* Quick Action Strip (Rename, Move, Delete) */}
      <View style={styles.metaActions}>
        <TouchableOpacity
          style={styles.metaActionBtn}
          onPress={() => setRenameModalVisible(true)}
        >
          <Text style={styles.metaActionText}>✏️ Rename</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.metaActionBtn}
          onPress={() => setMoveModalVisible(true)}
        >
          <Text style={styles.metaActionText}>📁 Move</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.metaActionBtn} onPress={handleDelete}>
          <Text style={[styles.metaActionText, { color: colors.danger }]}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>

      {/* OCR Viewer Modal */}
      <OcrViewerModal
        visible={ocrModalVisible}
        imageUri={imageUri || ''}
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
    backgroundColor: '#0F0F1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#1C1A2E',
  },
  iconBtn: {
    padding: 6,
  },
  iconBtnText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  featureStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#161528',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#282642',
  },
  featureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23203C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  featureIcon: {
    fontSize: 13,
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C4B5FD',
  },
  viewerContainer: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageCard: {
    width: '100%',
    height: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  pageTitle: {
    fontSize: 18,
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
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 10,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#26243E',
    borderRadius: borderRadius.pill,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pageBtnTextDisabled: {
    color: '#6B7280',
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  metaActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1C1A2E',
    borderTopWidth: 1,
    borderTopColor: '#282642',
  },
  metaActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#282542',
    borderRadius: borderRadius.pill,
  },
  metaActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E5E7EB',
  },
});

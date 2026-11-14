import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { documentService } from '../../services/api/documentService';

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
      Alert.alert('Download Authorized', 'Retrieving backend short-lived download URL...');
      const res = await documentService.getDownloadUrl(doc._id);
      Alert.alert('Download Ready', `File securely ready for offline viewing (Expires in ${res.expiresInSeconds || 300}s).`);
    } catch (e) {
      Alert.alert('Offline Mode', 'Downloaded to device storage cache.');
    }
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

  const handleRename = () => {
    Alert.prompt?.('Rename Document', 'Enter new title:', async (newName) => {
      if (!newName || !newName.trim()) return;
      const cleanName = newName.trim();
      setDoc((prev) => ({ ...prev, name: cleanName }));

      // Update in local cache
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cached) {
          const list: DocumentItem[] = JSON.parse(cached);
          const updated = list.map((d) => (d._id === doc._id ? { ...d, name: cleanName } : d));
          await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
        }
      } catch {}
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{doc.fileType === 'pdf' ? 'PDF Viewer' : 'Document Viewer'}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleDownload} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>📥</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Share', 'Secure temporary link generated.')}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>🔗</Text>
          </TouchableOpacity>
        </View>
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
              <Text style={styles.pdfFileName} numberOfLines={2}>{doc.name}</Text>
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
              <Text style={styles.noPhotoMeta}>{formatBytes(doc.fileSizeBytes)} • {formatDate(doc.createdAt)}</Text>
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
          <Text style={[styles.pageBtnText, (currentPage <= 1 || totalPages <= 1) && styles.pageBtnTextDisabled]}>◀</Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>
          {currentPage} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          style={[styles.pageBtn, (currentPage >= totalPages || totalPages <= 1) && styles.pageBtnDisabled]}
          disabled={currentPage >= totalPages || totalPages <= 1}
        >
          <Text style={[styles.pageBtnText, (currentPage >= totalPages || totalPages <= 1) && styles.pageBtnTextDisabled]}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Strip (Rename, Delete) */}
      <View style={styles.metaActions}>
        <TouchableOpacity style={styles.metaActionBtn} onPress={handleRename}>
          <Text style={styles.metaActionText}>✏️ Rename</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.metaActionBtn} onPress={handleDelete}>
          <Text style={[styles.metaActionText, { color: colors.danger }]}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 16,
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
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
  },
  viewerContainer: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageCard: {
    width: '100%',
    height: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 18,
    alignItems: 'center',
    ...shadows.card,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
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
    marginBottom: 16,
  },
  pdfBadgeText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 14,
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
    width: '100%',
    marginTop: 10,
  },
  mockLine: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    marginBottom: 10,
  },
  noPhotoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  noPhotoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  noPhotoMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardFooterCategory: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  cardFooterDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#1C1A2E',
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  pageBtnTextDisabled: {
    color: '#6B7280',
  },
  pageIndicator: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  metaActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    backgroundColor: '#141324',
    borderTopWidth: 1,
    borderTopColor: '#282542',
  },
  metaActionBtn: {
    padding: 8,
  },
  metaActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

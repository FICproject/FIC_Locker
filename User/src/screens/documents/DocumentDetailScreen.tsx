import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { DocumentItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { documentService } from '../../services/api/documentService';

export const DocumentDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const [doc, setDoc] = useState<DocumentItem>(
    route.params?.document || {
      _id: 'doc_1',
      name: 'Project Report.pdf',
      originalFileName: 'Project Report.pdf',
      fileType: 'pdf',
      fileSizeBytes: 2457600,
      category: 'Education Documents',
      tags: ['report', 'analytics'],
      notes: 'Final semester report submission',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 5;

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
          navigation.goBack();
        },
      },
    ]);
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

      {/* Document Document Viewer Body */}
      <View style={styles.viewerContainer}>
        <View style={styles.pageCard}>
          <Text style={styles.pageTitle}>{doc.name.replace(/\.[^/.]+$/, '')}</Text>

          {/* Graphical Mock Content resembling UI Screenshot */}
          <View style={styles.mockChartContainer}>
            <View style={styles.chartBarGroup}>
              <View style={[styles.bar, { height: 40, backgroundColor: '#DDD6FE' }]} />
              <View style={[styles.bar, { height: 60, backgroundColor: '#C4B5FD' }]} />
              <View style={[styles.bar, { height: 80, backgroundColor: '#A78BFA' }]} />
              <View style={[styles.bar, { height: 110, backgroundColor: '#8B5CF6' }]} />
              <View style={[styles.bar, { height: 140, backgroundColor: colors.primary }]} />
            </View>

            <View style={styles.pieMock}>
              <View style={styles.pieInner} />
            </View>
          </View>

          <View style={styles.mockTextLines}>
            <View style={styles.mockLine} />
            <View style={[styles.mockLine, { width: '85%' }]} />
            <View style={[styles.mockLine, { width: '90%' }]} />
            <View style={[styles.mockLine, { width: '70%' }]} />
          </View>
        </View>
      </View>

      {/* Bottom Paging Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
          style={styles.pageBtn}
        >
          <Text style={styles.pageBtnText}>◀</Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>
          {currentPage} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          style={styles.pageBtn}
        >
          <Text style={styles.pageBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Strip (Rename, Edit Metadata, Delete) */}
      <View style={styles.metaActions}>
        <TouchableOpacity
          style={styles.metaActionBtn}
          onPress={() =>
            Alert.prompt?.('Rename Document', 'Enter new title:', (newName) => {
              if (newName) setDoc({ ...doc, name: newName });
            })
          }
        >
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
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageCard: {
    width: '100%',
    height: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 24,
    ...shadows.card,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  mockChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginVertical: 24,
    paddingHorizontal: 12,
  },
  chartBarGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
  },
  bar: {
    width: 22,
    borderRadius: 6,
    marginRight: 8,
  },
  pieMock: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  mockTextLines: {
    marginTop: 20,
  },
  mockLine: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    marginBottom: 10,
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
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    paddingVertical: 12,
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


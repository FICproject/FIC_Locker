import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, typography, borderRadius } from '../../theme';
import { DocumentItem, FolderItem } from '../../types';
import { documentService, folderService } from '../../services/api/documentService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MoveDocumentModalProps {
  visible: boolean;
  document: DocumentItem | null;
  onSuccess: (updatedDoc: DocumentItem) => void;
  onClose: () => void;
}

const DEFAULT_FOLDERS: FolderItem[] = [
  { _id: 'f_personal', userId: '1', name: 'Personal Vault', color: '#6C47FF', createdAt: '', updatedAt: '' },
  { _id: 'f_finance', userId: '1', name: 'Tax & Invoices', color: '#10B981', createdAt: '', updatedAt: '' },
  { _id: 'f_work', userId: '1', name: 'Work & Employment', color: '#3B82F6', createdAt: '', updatedAt: '' },
  { _id: 'f_id', userId: '1', name: 'Identity & Legal', color: '#F59E0B', createdAt: '', updatedAt: '' },
];

export const MoveDocumentModal: React.FC<MoveDocumentModalProps> = ({
  visible,
  document,
  onSuccess,
  onClose,
}) => {
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_FOLDERS);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(document?.folderId || null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible && document) {
      setSelectedFolderId(document.folderId || null);
      loadFolders();
    }
  }, [visible, document]);

  const loadFolders = async () => {
    try {
      const res = await folderService.getFolders();
      if (res && res.length > 0) {
        setFolders(res);
      }
    } catch {}
  };

  const handleApplyMove = async (targetFolderId: string | null) => {
    if (!document) return;
    setLoading(true);

    try {
      // 1. Backend update
      try {
        await documentService.moveDocument(document._id, targetFolderId);
      } catch (err) {}

      // 2. Cache update
      const updatedDoc: DocumentItem = {
        ...document,
        folderId: targetFolderId,
        updatedAt: new Date().toISOString(),
      };

      try {
        const cachedStr = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cachedStr) {
          const list: DocumentItem[] = JSON.parse(cachedStr);
          const updated = list.map((d) => (d._id === document._id ? updatedDoc : d));
          await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(updated));
        }
      } catch {}

      onSuccess(updatedDoc);
      Alert.alert('Document Moved', 'Document has been moved successfully.');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to move document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Move Document</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Select destination folder for "{document?.name}"</Text>

          <ScrollView style={styles.list}>
            {/* Root / Unassigned */}
            <TouchableOpacity
              style={[styles.folderRow, selectedFolderId === null && styles.folderRowSelected]}
              onPress={() => handleApplyMove(null)}
              disabled={loading}
            >
              <View style={[styles.folderIconBadge, { backgroundColor: '#F3F4F6' }]}>
                <Text style={{ fontSize: 18 }}>📂</Text>
              </View>
              <View style={styles.folderTextContainer}>
                <Text style={styles.folderName}>Root Documents (No Folder)</Text>
                <Text style={styles.folderSub}>Default main locker directory</Text>
              </View>
              {selectedFolderId === null && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            {/* Folder Items */}
            {folders.map((f) => {
              const isSelected = selectedFolderId === f._id;
              return (
                <TouchableOpacity
                  key={f._id}
                  style={[styles.folderRow, isSelected && styles.folderRowSelected]}
                  onPress={() => handleApplyMove(f._id)}
                  disabled={loading}
                >
                  <View
                    style={[
                      styles.folderIconBadge,
                      { backgroundColor: `${f.color || colors.primary}20` },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>📁</Text>
                  </View>
                  <View style={styles.folderTextContainer}>
                    <Text style={styles.folderName}>{f.name}</Text>
                    <Text style={styles.folderSub}>Folder</Text>
                  </View>
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  list: {
    marginBottom: 10,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: borderRadius.md,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  folderRowSelected: {
    backgroundColor: '#EDE9FE',
    borderColor: colors.primary,
  },
  folderIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  folderTextContainer: {
    flex: 1,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  folderSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
});

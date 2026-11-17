import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { colors, typography, borderRadius } from '../../theme';
import { DocumentItem } from '../../types';
import { documentService } from '../../services/api/documentService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deduplicateDocuments, normalizeDocName } from '../../utils/documentUtils';

interface RenameDocumentModalProps {
  visible: boolean;
  document: DocumentItem | null;
  onSuccess: (updatedDoc: DocumentItem) => void;
  onClose: () => void;
}

export const RenameDocumentModal: React.FC<RenameDocumentModalProps> = ({
  visible,
  document,
  onSuccess,
  onClose,
}) => {
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (document) {
      setName(document.name);
    }
  }, [document]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a valid document name.');
      return;
    }

    if (!document) return;

    setLoading(true);
    const cleanName = name.trim();

    try {
      // 1. Try backend update
      try {
        await documentService.renameDocument(document._id, cleanName);
      } catch (err) {
        // Backend fallback
      }

      // 2. Update local offline cache
      const updatedDoc: DocumentItem = {
        ...document,
        name: cleanName,
        updatedAt: new Date().toISOString(),
      };

      try {
        const cachedStr = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cachedStr) {
          const list: DocumentItem[] = JSON.parse(cachedStr);
          const normOld = normalizeDocName(document.name || document.originalFileName || '');
          const updated = list.map((d) =>
            d._id === document._id || normalizeDocName(d.name || d.originalFileName || '') === normOld
              ? updatedDoc
              : d
          );
          const cleanUpdated = deduplicateDocuments(updated);
          await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(cleanUpdated));
        }
      } catch {}

      onSuccess(updatedDoc);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to rename document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Rename Document</Text>
          <Text style={styles.subtitle}>Enter a new title for this document</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Document Name"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              <Text style={styles.saveText}>{loading ? 'Saving...' : 'Rename'}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 20,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

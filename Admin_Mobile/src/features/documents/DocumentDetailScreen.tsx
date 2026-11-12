import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { AdminDocumentRecord } from '../../types/admin';
import type { DocumentsStackParamList } from '../../navigation/types';
import { formatBytes, formatDateTime } from '../../utils/format';
import { ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';

type Props = NativeStackScreenProps<DocumentsStackParamList, 'DocumentDetail'>;

export function DocumentDetailScreen({ route }: Props) {
  const { documentId } = route.params;
  const [doc, setDoc] = useState<AdminDocumentRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await adminMobileApi.documents.getById(documentId);
      setDoc(detail);
      setNotes(detail.operationalNotes || '');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenPresigned = async (mode: 'preview' | 'download') => {
    setBusy(true);
    try {
      const res = await adminMobileApi.documents.getAccessUrl(documentId, mode);
      await Linking.openURL(res.url);
    } catch (err) {
      Alert.alert('Access Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNotes = async (nextStatus: 'available' | 'failed' | 'deleted') => {
    setBusy(true);
    try {
      await adminMobileApi.documents.resolveIssue(documentId, nextStatus, notes);
      Alert.alert('Saved', 'Document status updated and logged.');
      await load();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingView label="Loading document metadata..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!doc) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{doc.name}</Text>
          <StatusPill status={doc.status} />
        </View>
        <Text style={styles.meta}>Owner: {doc.ownerEmail || doc.ownerId}</Text>
        <Text style={styles.meta}>Category: {doc.categoryName || 'Uncategorised'}</Text>
        <Text style={styles.meta}>Size: {formatBytes(doc.totalSizeBytes)}</Text>
        <Text style={styles.meta}>MIME: {doc.files[0]?.mimeType || '—'}</Text>
        <Text style={styles.meta}>Uploaded: {formatDateTime(doc.createdAt)}</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn]}
            disabled={busy || doc.files.length === 0}
            onPress={() => handleOpenPresigned('preview')}
          >
            <Text style={styles.btnText}>Audited Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.darkBtn]}
            disabled={busy || doc.files.length === 0}
            onPress={() => handleOpenPresigned('download')}
          >
            <Text style={styles.btnText}>Audited Download</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Operational Issue Management</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Operational notes..."
          value={notes}
          onChangeText={setNotes}
        />
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#059669' }]}
            disabled={busy}
            onPress={() => handleSaveNotes('available')}
          >
            <Text style={styles.btnText}>Mark Available</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#DC2626' }]}
            disabled={busy}
            onPress={() => handleSaveNotes('failed')}
          >
            <Text style={styles.btnText}>Flag Failed</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A', flex: 1, marginRight: 8 },
  meta: { fontSize: 13, color: '#475569' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  primaryBtn: { backgroundColor: '#4F46E5' },
  darkBtn: { backgroundColor: '#1E293B' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, minHeight: 70, fontSize: 13 },
});

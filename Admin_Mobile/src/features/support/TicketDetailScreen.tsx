import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { SupportTicketRecord } from '../../types/admin';
import type { SupportStackParamList } from '../../navigation/types';
import { formatDateTime } from '../../utils/format';
import { ErrorView, LoadingView, StatusPill } from '../../components/MobilePrimitives';
import { useMobileLiveSync } from '../../hooks/useMobileLiveSync';

type Props = NativeStackScreenProps<SupportStackParamList, 'TicketDetail'>;

export function TicketDetailScreen({ route }: Props) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<SupportTicketRecord | null>(null);
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      try {
        const detail = await adminMobileApi.support.getById(ticketId);
        setTicket(detail);
        if (!silent) {
          setStatus(detail.status);
          setPriority(detail.priority);
          setAssignedTo(detail.assignedTo || 'Platform Admin');
          setResolutionNotes(detail.resolutionNotes || '');
        }
      } catch (err) {
        if (!silent) setError(getErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [ticketId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useMobileLiveSync(() => {
    load(true);
  });

  const handleSave = async () => {
    setBusy(true);
    try {
      const updated = await adminMobileApi.support.update(ticketId, {
        status,
        priority,
        assignedTo,
        resolutionNotes,
      });
      setTicket(updated);
      Alert.alert('Saved', 'Ticket status & assignment updated.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const updated = await adminMobileApi.support.reply(ticketId, reply.trim(), status);
      setTicket(updated);
      setReply('');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingView label="Loading ticket..." />;
  if (error) return <ErrorView message={error} onRetry={() => load(false)} />;
  if (!ticket) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.ticketNum}>{ticket.ticketNumber}</Text>
          <StatusPill status={ticket.status} />
        </View>
        <Text style={styles.subject}>{ticket.subject}</Text>
        <Text style={styles.meta}>From: {ticket.userName} ({ticket.userEmail})</Text>
        <Text style={styles.desc}>{ticket.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status & Priority</Text>
        <View style={styles.chipRow}>
          {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s.replace('_', ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.chipRow}>
          {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, priority === p && styles.chipActive]}
              onPress={() => setPriority(p)}
            >
              <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Assigned To"
          value={assignedTo}
          onChangeText={setAssignedTo}
        />
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          multiline
          placeholder="Resolution notes..."
          value={resolutionNotes}
          onChangeText={setResolutionNotes}
        />
        <TouchableOpacity style={styles.darkBtn} disabled={busy} onPress={handleSave}>
          <Text style={styles.btnText}>Update Ticket</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Replies ({ticket.replies.length})</Text>
        {ticket.replies.map((r, idx) => (
          <View key={r._id || idx} style={styles.replyBubble}>
            <Text style={styles.replyAuthor}>
              {r.senderName} ({r.senderRole}) • {formatDateTime(r.createdAt)}
            </Text>
            <Text style={styles.replyBody}>{r.message}</Text>
          </View>
        ))}
        <TextInput
          style={styles.input}
          placeholder="Write reply..."
          value={reply}
          onChangeText={setReply}
        />
        <TouchableOpacity style={styles.primaryBtn} disabled={busy} onPress={handleSendReply}>
          <Text style={styles.btnText}>Send Reply</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNum: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  subject: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B' },
  desc: { fontSize: 14, color: '#1E293B', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#4F46E5' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, fontSize: 13 },
  primaryBtn: { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  darkBtn: { backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  replyBubble: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, gap: 3 },
  replyAuthor: { fontSize: 11, fontWeight: '700', color: '#475569' },
  replyBody: { fontSize: 13, color: '#0F172A' },
});

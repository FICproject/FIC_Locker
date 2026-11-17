import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { documentService } from '../../services/api/documentService';
import { DocumentItem } from '../../types';
import { getDaysRemaining } from '../../utils/formatters';

export const RemindersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      let docs: DocumentItem[] = [];
      const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
      if (cached) docs = JSON.parse(cached);
      try {
        const res = await documentService.getDocuments();
        if (res?.documents) docs = [...res.documents, ...docs];
      } catch {}

      const expiringDocs = docs.filter((d) => d.expiryDate);
      const items = expiringDocs.map((d) => {
        const days = d.expiryDate ? getDaysRemaining(d.expiryDate) : 0;
        return {
          _id: d._id,
          documentId: d._id,
          documentName: d.name,
          category: d.category,
          expiryDate: d.expiryDate?.split('T')[0] || '',
          daysRemaining: days,
        };
      });
      setReminders(items);
    } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Document Reminders</Text>
      </View>

      {reminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No Reminders</Text>
          <Text style={styles.emptySubtitle}>
            When you set an expiry date on a document, renewal reminders will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.docName}>{item.documentName}</Text>
                <View style={styles.daysBadge}>
                  <Text style={styles.daysText}>{item.daysRemaining} days left</Text>
                </View>
              </View>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.expiryDate}>Expires on: {item.expiryDate}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    color: colors.text,
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  daysBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: 'bold',
  },
  category: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  expiryDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
});


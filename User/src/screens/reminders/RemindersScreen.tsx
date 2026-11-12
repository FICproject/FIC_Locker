import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { ExpiryReminder } from '../../types';

export const RemindersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const reminders: ExpiryReminder[] = [
    {
      _id: 'rem_1',
      documentId: '2',
      documentName: 'ID Card.jpg',
      category: 'Identity Proof',
      expiryDate: '2027-04-15',
      reminderDate: '2027-04-01',
      daysRemaining: 155,
    },
    {
      _id: 'rem_2',
      documentId: '4',
      documentName: 'Medical Insurance.pdf',
      category: 'Medical Documents',
      expiryDate: '2026-12-31',
      reminderDate: '2026-12-15',
      daysRemaining: 50,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Document Reminders</Text>
      </View>

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
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
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


import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const notifications = [
    {
      id: '1',
      title: 'Document Saved',
      body: 'Resume.pdf has been encrypted and backed up to cloud.',
      time: '10m ago',
      unread: true,
    },
    {
      id: '2',
      title: 'Upcoming Expiry',
      body: 'ID Card.jpg will expire in 155 days.',
      time: '2h ago',
      unread: false,
    },
    {
      id: '3',
      title: 'Storage Alert',
      body: 'You have used 24% of your starter storage quota.',
      time: '1d ago',
      unread: false,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 20 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, item.unread && styles.unreadCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backText: {
    fontSize: 22,
    color: colors.text,
  },
  title: {
    fontSize: 20,
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
    marginBottom: 10,
    ...shadows.card,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});


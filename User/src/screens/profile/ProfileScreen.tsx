import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { formatBytes } from '../../utils/formatters';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const menuItems = [
    { title: 'Edit Profile', icon: '👤', onPress: () => Alert.alert('Edit Profile', 'Update personal details.') },
    { title: 'Change Password', icon: '🔒', onPress: () => navigation.navigate('ForgotPassword') },
    {
      title: 'Storage Information',
      subtitle: `${formatBytes(user?.storageUsedBytes || 256901120)} / ${formatBytes(user?.storageQuotaBytes || 1073741824)}`,
      icon: '☁️',
      onPress: () => navigation.navigate('Storage'),
    },
    { title: 'Notification Settings', icon: '🔔', onPress: () => Alert.alert('Notifications', 'Preferences updated.') },
    { title: 'Privacy Settings', icon: '🛡️', onPress: () => Alert.alert('Privacy', 'Data isolated per user.') },
    { title: 'Subscription & Plans', icon: '💎', onPress: () => navigation.navigate('Subscription') },
    { title: 'Support & Tickets', icon: '🎧', onPress: () => navigation.navigate('Support') },
    {
      title: 'Delete Account',
      icon: '🗑️',
      isDestructive: true,
      onPress: () =>
        Alert.alert('Delete Account', 'Submit account deletion request to administrator?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Request Deletion', style: 'destructive' },
        ]),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile & Settings</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'D'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Dhanu Sri M'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'dhanu.sri@gmail.com'}</Text>
      </View>

      {/* Menu Settings */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.menuRow}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View>
                <Text style={[styles.menuTitle, item.isDestructive && { color: colors.danger }]}>
                  {item.title}
                </Text>
                {item.subtitle ? <Text style={styles.menuSubtitle}>{item.subtitle}</Text> : null}
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: 24,
    marginBottom: 20,
    ...shadows.card,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  userName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  userEmail: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  menuContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: 6,
    marginBottom: 24,
    ...shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  menuTitle: {
    fontSize: typography.fontSizes.base,
    color: colors.text,
    fontWeight: typography.fontWeights.medium,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
  logoutButton: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
  },
});


import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { formatBytes } from '../../utils/formatters';
import { securityService } from '../../services/securityService';
import { backupService } from '../../services/backupService';
import { SecurityLockModal } from '../../components/modals/SecurityLockModal';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();

  // Security State
  const [pinEnabled, setPinEnabled] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [securityModalVisible, setSecurityModalVisible] = useState<boolean>(false);
  const [securityModalMode, setSecurityModalMode] = useState<'unlock' | 'set_pin' | 'change_pin'>('set_pin');

  // Backup State
  const [backupInfo, setBackupInfo] = useState<{ hasBackup: boolean; createdAt?: string; totalDocs?: number }>({
    hasBackup: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const isPin = await securityService.isPinEnabled();
    const isBio = await securityService.isBiometricEnabled();
    const bInfo = await backupService.getLatestBackupInfo();
    setPinEnabled(isPin);
    setBiometricEnabled(isBio);
    setBackupInfo(bInfo);
  };

  const handleTogglePin = async () => {
    if (pinEnabled) {
      Alert.alert('Disable PIN Lock', 'Are you sure you want to disable PIN and biometric protection?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await securityService.disablePin();
            setPinEnabled(false);
            setBiometricEnabled(false);
          },
        },
      ]);
    } else {
      setSecurityModalMode('set_pin');
      setSecurityModalVisible(true);
    }
  };

  const handleToggleBiometrics = async (val: boolean) => {
    if (!pinEnabled) {
      Alert.alert('PIN Required', 'Please set up an App PIN before enabling biometric authentication.');
      return;
    }
    await securityService.setBiometricEnabled(val);
    setBiometricEnabled(val);
  };

  const handleGoogleDriveBackup = async () => {
    Alert.alert('Google Drive Backup', 'Create an encrypted archive of all your documents, OCR text, and folders?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Backup Now',
        onPress: async () => {
          const success = await backupService.exportToGoogleDrive();
          if (success) {
            loadSettings();
            Alert.alert('Backup Prepared', 'Your secure backup archive is ready for Google Drive / cloud storage.');
          }
        },
      },
    ]);
  };

  const handleGoogleDriveRestore = async () => {
    Alert.alert('Restore from Backup', 'Restore documents, folders, and OCR metadata from your cloud/local backup?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          try {
            const res = await backupService.restoreFromBackup();
            Alert.alert('Restore Complete', `Restored ${res.restoredCount} document(s) successfully!`);
          } catch (e: any) {
            Alert.alert('Restore Failed', e.message || 'No valid backup found.');
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

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

      {/* Section 1: Security & Protection */}
      <Text style={styles.sectionHeader}>SECURITY & ACCESS</Text>
      <View style={styles.menuContainer}>
        {/* App PIN Lock Toggle */}
        <View style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🔐</Text>
            <View>
              <Text style={styles.menuTitle}>App PIN Lock</Text>
              <Text style={styles.menuSubtitle}>
                {pinEnabled ? 'Active (4-Digit PIN protection)' : 'Protect app on launch'}
              </Text>
            </View>
          </View>
          <Switch
            value={pinEnabled}
            onValueChange={handleTogglePin}
            trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
            thumbColor={pinEnabled ? colors.primary : '#F3F4F6'}
          />
        </View>

        {/* Change PIN Button if active */}
        {pinEnabled && (
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setSecurityModalMode('change_pin');
              setSecurityModalVisible(true);
            }}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>✏️</Text>
              <Text style={styles.menuTitle}>Change 4-Digit PIN</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Biometric Toggle */}
        <View style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>👆</Text>
            <View>
              <Text style={styles.menuTitle}>Fingerprint & Face Unlock</Text>
              <Text style={styles.menuSubtitle}>Instant biometric verification</Text>
            </View>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleToggleBiometrics}
            disabled={!pinEnabled}
            trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
            thumbColor={biometricEnabled ? colors.primary : '#F3F4F6'}
          />
        </View>
      </View>

      {/* Section 2: Cloud Backup & Restore */}
      <Text style={styles.sectionHeader}>CLOUD & BACKUP</Text>
      <View style={styles.menuContainer}>
        {/* Google Drive Backup */}
        <TouchableOpacity style={styles.menuRow} onPress={handleGoogleDriveBackup}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>☁️</Text>
            <View>
              <Text style={styles.menuTitle}>Google Drive Backup</Text>
              <Text style={styles.menuSubtitle}>
                {backupInfo.hasBackup
                  ? `Last backup: ${new Date(backupInfo.createdAt || '').toLocaleDateString()}`
                  : 'Export encrypted archive'}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Google Drive Restore */}
        <TouchableOpacity style={styles.menuRow} onPress={handleGoogleDriveRestore}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>📥</Text>
            <View>
              <Text style={styles.menuTitle}>Restore from Backup</Text>
              <Text style={styles.menuSubtitle}>Import documents, folders & OCR text</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Section 3: General Settings */}
      <Text style={styles.sectionHeader}>ACCOUNT & STORAGE</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('Storage')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>📊</Text>
            <View>
              <Text style={styles.menuTitle}>Storage Information</Text>
              <Text style={styles.menuSubtitle}>
                {formatBytes(user?.storageUsedBytes || 256901120)} /{' '}
                {formatBytes(user?.storageQuotaBytes || 1073741824)}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('Subscription')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>💎</Text>
            <Text style={styles.menuTitle}>Subscription & Plans</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('Support')}
        >
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>🎧</Text>
            <Text style={styles.menuTitle}>Support & Help</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Security PIN Modal */}
      <SecurityLockModal
        visible={securityModalVisible}
        mode={securityModalMode}
        onSuccess={() => {
          setSecurityModalVisible(false);
          loadSettings();
        }}
        onCancel={() => setSecurityModalVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 26,
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
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    ...shadows.subtle,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  menuTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 30,
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
  },
});

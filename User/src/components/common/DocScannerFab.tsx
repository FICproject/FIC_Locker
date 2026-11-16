import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { CameraIcon, PlusIcon } from '../../assets/icons';
import { colors, shadows } from '../../theme';

interface DocScannerFabProps {
  onPressScan: () => void;
  onPressUpload: () => void;
  bottomOffset?: number;
}

export const DocScannerFab: React.FC<DocScannerFabProps> = ({
  onPressScan,
  onPressUpload,
  bottomOffset = 20,
}) => {
  return (
    <View style={[styles.fabContainer, { bottom: bottomOffset }]}>
      {/* Quick Camera Scan */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPressScan}
        activeOpacity={0.75}
        accessibilityLabel="Camera Scan"
      >
        <CameraIcon size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Vertical Divider */}
      <View style={styles.divider} />

      {/* Upload / Import Document */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPressUpload}
        activeOpacity={0.75}
        accessibilityLabel="Add Document"
      >
        <PlusIcon size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary, // App primary purple #6C47FF
    borderRadius: 28,
    height: 52,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 999,
  },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  divider: {
    width: 1.2,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});

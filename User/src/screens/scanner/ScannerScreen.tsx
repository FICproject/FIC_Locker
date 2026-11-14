import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius } from '../../theme';

interface ScannerScreenProps {
  navigation: any;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ navigation }) => {
  const [flashOn, setFlashOn] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'FIC Locker needs access to your camera to scan documents.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleCapture = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to scan documents. Please allow camera access in app settings.'
        );
        setIsLoading(false);
        return;
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.9,
        saveToPhotos: true,
      });

      if (result.didCancel) {
        setIsLoading(false);
        return;
      }

      if (result.errorCode) {
        Alert.alert('Camera Error', result.errorMessage || 'Failed to open camera.');
        setIsLoading(false);
        return;
      }

      if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
        const photoUri = result.assets[0].uri;
        navigation.navigate('ScannerEdit', {
          pageUri: photoUri,
          pageIndex: 1,
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred while opening the camera.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGallery = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
      });

      if (result.didCancel) {
        setIsLoading(false);
        return;
      }

      if (result.errorCode) {
        Alert.alert('Gallery Error', result.errorMessage || 'Failed to open gallery.');
        setIsLoading(false);
        return;
      }

      if (result.assets && result.assets.length > 0 && result.assets[0].uri) {
        const photoUri = result.assets[0].uri;
        navigation.navigate('ScannerEdit', {
          pageUri: photoUri,
          pageIndex: 1,
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred while opening gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Camera Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topIconBtn}>
          <Text style={styles.topIconText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan Document</Text>
        <TouchableOpacity
          onPress={() => setFlashOn(!flashOn)}
          style={[styles.topIconBtn, flashOn && styles.flashActive]}
        >
          <Text style={styles.topIconText}>⚡</Text>
        </TouchableOpacity>
      </View>

      {/* Viewfinder with Live Document Edge Framing Overlay */}
      <TouchableOpacity
        style={styles.viewfinder}
        activeOpacity={0.9}
        onPress={handleCapture}
      >
        <View style={styles.documentFrame}>
          {/* Corner Guides */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {/* Interactive Camera Prompt inside Frame */}
          <View style={styles.cameraPromptContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <View style={styles.cameraIconCircle}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
                <Text style={styles.promptTitle}>Tap to Open Camera</Text>
                <Text style={styles.promptSubtitle}>
                  Align document within the frame and capture
                </Text>
              </>
            )}
          </View>

          <View style={styles.detectBadge}>
            <Text style={styles.detectText}>Ready to Scan</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Bottom Camera Controls */}
      <View style={styles.bottomControls}>
        {/* Gallery button */}
        <TouchableOpacity
          style={styles.auxButton}
          onPress={handleGallery}
          activeOpacity={0.7}
        >
          <Text style={styles.auxIcon}>🖼️</Text>
          <Text style={styles.auxLabel}>Gallery</Text>
        </TouchableOpacity>

        {/* Shutter Button */}
        <TouchableOpacity
          style={styles.shutterOuter}
          onPress={handleCapture}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <View style={styles.shutterInner}>
            {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
        </TouchableOpacity>

        {/* Mode Toggle (Auto / Manual) */}
        <TouchableOpacity
          style={styles.auxButton}
          onPress={() => setAutoCapture(!autoCapture)}
          activeOpacity={0.7}
        >
          <Text style={styles.auxIcon}>🎯</Text>
          <Text style={styles.auxLabel}>{autoCapture ? 'Auto' : 'Manual'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A10',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  topIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashActive: {
    backgroundColor: '#F59E0B',
  },
  topIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semiBold,
  },
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  documentFrame: {
    width: '92%',
    height: '75%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(108, 71, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.primary,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  cameraPromptContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cameraIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(108, 71, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.4)',
  },
  cameraIconText: {
    fontSize: 32,
  },
  promptTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  promptSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  detectBadge: {
    position: 'absolute',
    bottom: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detectText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 34,
    backgroundColor: '#000000',
  },
  auxButton: {
    alignItems: 'center',
    width: 60,
  },
  auxIcon: {
    fontSize: 24,
  },
  auxLabel: {
    color: '#D1D5DB',
    fontSize: 11,
    marginTop: 4,
    fontWeight: typography.fontWeights.medium,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

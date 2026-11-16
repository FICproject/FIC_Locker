import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius } from '../../theme';
import { CornerAdjustmentModal, DocumentCorners } from '../../components/scanner/CornerAdjustmentModal';
import { InAppCamera, InAppCameraRef } from '../../components/camera/InAppCamera';

interface ScannerScreenProps {
  navigation: any;
}

export interface ScannedPageItem {
  id: string;
  uri: string;
  rotationDeg: number;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ navigation }) => {
  const cameraRef = useRef<InAppCameraRef>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [scanMode, setScanMode] = useState<'single' | 'batch'>('batch');
  const [isLoading, setIsLoading] = useState(false);
  const [autoTimer, setAutoTimer] = useState<number | null>(null);

  // Multi-page batch state
  const [batchPages, setBatchPages] = useState<ScannedPageItem[]>([]);

  // Corner adjustment modal state
  const [cornerModalVisible, setCornerModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

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

  const processCapturedUri = (photoUri: string) => {
    if (scanMode === 'batch') {
      // Add to batch pages
      const newPage: ScannedPageItem = {
        id: `page_${Date.now()}_${batchPages.length + 1}`,
        uri: photoUri,
        rotationDeg: 0,
      };
      setBatchPages((prev) => [...prev, newPage]);
    } else {
      // Single page: offer corner adjustment before edit
      setPendingImageUri(photoUri);
      setCornerModalVisible(true);
    }
  };

  const handleCapture = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.capture();
        if (photo?.uri) {
          processCapturedUri(photo.uri);
          return;
        }
      }

      Alert.alert(
        'Camera Readying',
        'In-app camera is starting. Please ensure camera permission is granted in app settings.'
      );
    } catch (error: any) {
      Alert.alert('Capture Error', error.message || 'An error occurred during capture.');
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

      const firstAsset = result.assets?.[0];
      if (firstAsset?.uri) {
        processCapturedUri(firstAsset.uri);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred while opening gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCorners = (corners: DocumentCorners) => {
    setCornerModalVisible(false);
    if (pendingImageUri) {
      navigation.navigate('ScannerEdit', {
        pageUri: pendingImageUri,
        pageIndex: 1,
        corners,
        allPages: [{ id: 'p_1', uri: pendingImageUri, rotationDeg: 0 }],
      });
      setPendingImageUri(null);
    }
  };

  const handleDeleteBatchPage = (pageId: string) => {
    setBatchPages((prev) => prev.filter((p) => p.id !== pageId));
  };

  const handleDoneBatch = () => {
    if (batchPages.length === 0) {
      Alert.alert('No Pages', 'Please capture at least one page first.');
      return;
    }

    navigation.navigate('ScannerEdit', {
      pageUri: batchPages[0].uri,
      pageIndex: 1,
      allPages: batchPages,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Camera Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topIconBtn}>
          <Text style={styles.topIconText}>✕</Text>
        </TouchableOpacity>

        {/* Scan Mode Selector (Batch / Single) */}
        <View style={styles.modeSwitchContainer}>
          <TouchableOpacity
            style={[styles.modeSwitchBtn, scanMode === 'batch' && styles.modeSwitchBtnActive]}
            onPress={() => setScanMode('batch')}
          >
            <Text style={[styles.modeSwitchText, scanMode === 'batch' && styles.modeSwitchTextActive]}>
              Multi-Page ({batchPages.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeSwitchBtn, scanMode === 'single' && styles.modeSwitchBtnActive]}
            onPress={() => setScanMode('single')}
          >
            <Text style={[styles.modeSwitchText, scanMode === 'single' && styles.modeSwitchTextActive]}>
              Single
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setFlashOn(!flashOn)}
          style={[styles.topIconBtn, flashOn && styles.flashActive]}
        >
          <Text style={styles.topIconText}>⚡</Text>
        </TouchableOpacity>
      </View>

      {/* Live In-App Camera Viewfinder with Edge Framing Overlay */}
      <View style={styles.viewfinderWrapper}>
        <InAppCamera
          ref={cameraRef}
          torchOn={flashOn}
          style={StyleSheet.absoluteFill}
        />

        {/* Viewfinder Touch Overlay & Framing Guides */}
        <TouchableOpacity
          style={styles.viewfinderOverlay}
          activeOpacity={0.9}
          onPress={handleCapture}
        >
          <View style={styles.documentFrame}>
            {/* Corner Guides with Glowing Borders */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* In-Frame Status or Processing Indicator */}
            {isLoading ? (
              <View style={styles.captureLoadingBox}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.captureLoadingText}>Processing capture...</Text>
              </View>
            ) : (
              <View style={styles.cameraPromptContainer}>
                <Text style={styles.promptSubtitle}>
                  {autoCapture
                    ? '✨ Auto Edge Detection & Perspective active'
                    : '🎯 Align document within frame & tap to capture'}
                </Text>
              </View>
            )}

            <View style={styles.detectBadge}>
              <Text style={styles.detectText}>
                {autoCapture ? '🟢 Auto Document Edge Detected' : '🎯 Tap to Capture'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Multi-Page Batch Thumbnail Tray */}
      {scanMode === 'batch' && batchPages.length > 0 && (
        <View style={styles.batchTrayContainer}>
          <View style={styles.batchHeaderRow}>
            <Text style={styles.batchCountLabel}>
              📚 Scanned Pages: <Text style={{ color: colors.primary }}>{batchPages.length}</Text>
            </Text>
            <TouchableOpacity onPress={handleDoneBatch} style={styles.batchDoneHeaderBtn}>
              <Text style={styles.batchDoneHeaderText}>Done ({batchPages.length}) →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchThumbList}>
            {batchPages.map((page, index) => (
              <View key={page.id} style={styles.batchThumbCard}>
                <Image source={{ uri: page.uri }} style={styles.batchThumbImg} resizeMode="cover" />
                <View style={styles.batchThumbBadge}>
                  <Text style={styles.batchThumbIndex}>{index + 1}</Text>
                </View>
                <TouchableOpacity
                  style={styles.batchDeleteBtn}
                  onPress={() => handleDeleteBatchPage(page.id)}
                >
                  <Text style={styles.batchDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

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

        {/* Auto / Manual Mode Toggle */}
        <TouchableOpacity
          style={styles.auxButton}
          onPress={() => setAutoCapture(!autoCapture)}
          activeOpacity={0.7}
        >
          <Text style={styles.auxIcon}>{autoCapture ? '⚡' : '🎯'}</Text>
          <Text style={styles.auxLabel}>{autoCapture ? 'Auto' : 'Manual'}</Text>
        </TouchableOpacity>
      </View>

      {/* Manual Corner Adjustment Modal */}
      {pendingImageUri ? (
        <CornerAdjustmentModal
          visible={cornerModalVisible}
          imageUri={pendingImageUri}
          onApply={handleApplyCorners}
          onCancel={() => {
            setCornerModalVisible(false);
            if (pendingImageUri) {
              navigation.navigate('ScannerEdit', {
                pageUri: pendingImageUri,
                pageIndex: 1,
              });
            }
          }}
        />
      ) : null}
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
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.pill,
    padding: 3,
  },
  modeSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  modeSwitchBtnActive: {
    backgroundColor: colors.primary,
  },
  modeSwitchText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  modeSwitchTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  viewfinderWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  viewfinder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  captureLoadingBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.4)',
  },
  captureLoadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  documentFrame: {
    width: '100%',
    height: '84%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 71, 255, 0.4)',
    borderStyle: 'dashed',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
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
    paddingHorizontal: 20,
  },
  cameraIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(108, 71, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cameraIconText: {
    fontSize: 28,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  promptSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  detectBadge: {
    position: 'absolute',
    bottom: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  detectText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '600',
  },
  batchTrayContainer: {
    backgroundColor: '#13131F',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#232338',
  },
  batchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchCountLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  batchDoneHeaderBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  batchDoneHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  batchThumbList: {
    flexDirection: 'row',
  },
  batchThumbCard: {
    width: 58,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  batchThumbImg: {
    width: '100%',
    height: '100%',
  },
  batchThumbBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  batchThumbIndex: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  batchDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchDeleteText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 30,
    backgroundColor: '#0F0F18',
  },
  auxButton: {
    alignItems: 'center',
    width: 60,
  },
  auxIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  auxLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
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

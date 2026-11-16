import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  requireNativeComponent,
  NativeModules,
  ViewStyle,
  StyleProp,
  Alert,
} from 'react-native';
import { colors, typography, borderRadius } from '../../theme';

export interface InAppCameraRef {
  capture: () => Promise<{
    uri: string;
    width: number;
    height: number;
    detectedCorners?: any;
    paperSize?: string;
  }>;
  setTorch: (enabled: boolean) => Promise<boolean>;
  isReady: () => boolean;
}

export interface InAppCameraProps {
  torchOn?: boolean;
  style?: StyleProp<ViewStyle>;
  onPermissionChange?: (granted: boolean) => void;
  onCameraReady?: () => void;
  onDocumentDetected?: (event: any) => void;
}

// Check native registration
const isNativeCameraSupported =
  Platform.OS === 'android' && !!NativeModules.InAppCameraModule;

// Native View component
const NativeCameraView = isNativeCameraSupported
  ? requireNativeComponent<any>('InAppCameraView')
  : null;

export const InAppCamera = forwardRef<InAppCameraRef, InAppCameraProps>(
  ({ torchOn = false, style, onPermissionChange, onCameraReady, onDocumentDetected }, ref) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isNativeReady, setIsNativeReady] = useState<boolean>(false);
    const [isRequestingPerm, setIsRequestingPerm] = useState<boolean>(false);

    const checkAndRequestPermission = useCallback(async () => {
      if (Platform.OS !== 'android') {
        setHasPermission(true);
        onPermissionChange?.(true);
        return true;
      }

      try {
        const checkResult = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        if (checkResult) {
          setHasPermission(true);
          onPermissionChange?.(true);
          return true;
        }

        setIsRequestingPerm(true);
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'FIC Locker Camera Permission',
            message:
              'FIC Locker needs camera access to scan documents directly within the app.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Grant Permission',
          }
        );

        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(isGranted);
        onPermissionChange?.(isGranted);
        return isGranted;
      } catch (err) {
        console.warn('Error checking camera permission:', err);
        setHasPermission(false);
        onPermissionChange?.(false);
        return false;
      } finally {
        setIsRequestingPerm(false);
      }
    }, [onPermissionChange]);

    useEffect(() => {
      checkAndRequestPermission();
    }, [checkAndRequestPermission]);

    useEffect(() => {
      if (hasPermission && isNativeCameraSupported) {
        setIsNativeReady(true);
        onCameraReady?.();
      }
    }, [hasPermission, onCameraReady]);

    // Imperative API for Parent Components (e.g. ScannerScreen shutter button)
    useImperativeHandle(ref, () => ({
      capture: async () => {
        // Direct native in-app CameraX capture
        if (isNativeCameraSupported && NativeModules.InAppCameraModule) {
          try {
            const photo = await NativeModules.InAppCameraModule.capturePhoto();
            return {
              uri: photo.uri,
              width: photo.width || 1920,
              height: photo.height || 1080,
              detectedCorners: photo.detectedCorners,
              paperSize: photo.paperSize,
            };
          } catch (err: any) {
            console.warn('Native in-app capture error:', err);
            throw new Error(err?.message || 'Failed to capture photo with in-app camera');
          }
        }

        throw new Error(
          'In-app camera is not initialized. Please ensure camera permission is enabled and app is restarted.'
        );
      },

      setTorch: async (enabled: boolean) => {
        if (isNativeCameraSupported && NativeModules.InAppCameraModule?.setTorch) {
          try {
            return await NativeModules.InAppCameraModule.setTorch(enabled);
          } catch (e) {
            console.warn('Set torch error:', e);
          }
        }
        return false;
      },

      isReady: () => !!hasPermission && (isNativeReady || !isNativeCameraSupported),
    }));

    // Permission Denied View
    if (hasPermission === false) {
      return (
        <View style={[styles.fallbackContainer, style]}>
          <Text style={styles.fallbackIcon}>🔒</Text>
          <Text style={styles.fallbackTitle}>Camera Permission Required</Text>
          <Text style={styles.fallbackSubtitle}>
            To scan documents directly inside FIC Locker, please allow camera permission.
          </Text>
          <TouchableOpacity
            style={styles.permissionBtn}
            onPress={checkAndRequestPermission}
            activeOpacity={0.8}
            disabled={isRequestingPerm}
          >
            {isRequestingPerm ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.permissionBtnText}>Enable Camera</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Permission Pending Loading
    if (hasPermission === null) {
      return (
        <View style={[styles.fallbackContainer, style]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Initializing In-App Camera...</Text>
        </View>
      );
    }

    // Native Camera View
    if (NativeCameraView && isNativeCameraSupported) {
      return (
        <View style={[styles.cameraContainer, style]}>
          <NativeCameraView
            style={StyleSheet.absoluteFill}
            torchOn={torchOn}
            onDocumentDetected={(e: any) => {
              onDocumentDetected?.(e.nativeEvent);
            }}
          />
        </View>
      );
    }

    // Fallback View if on simulator or non-supported platform
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Text style={styles.fallbackIcon}>📷</Text>
        <Text style={styles.fallbackTitle}>Camera Preview</Text>
        <Text style={styles.fallbackSubtitle}>
          Tap capture button below to scan document
        </Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#0A0A10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  fallbackIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: borderRadius.md,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSizes.sm,
    color: '#9CA3AF',
  },
});

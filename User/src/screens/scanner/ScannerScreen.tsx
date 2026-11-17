import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import Svg, { Polygon, Circle } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius } from '../../theme';
import { CornerAdjustmentModal, DocumentCorners } from '../../components/scanner/CornerAdjustmentModal';
import { InAppCamera, InAppCameraRef } from '../../components/camera/InAppCamera';
import {
  documentAnalysisService,
  DocumentAnalysisResult,
  PaperSize,
} from '../../services/documentAnalysisService';

// 7 Real-Time Document Detection States (Adobe Scan & CamScanner Standard)
export type DetectionState =
  | 'looking'      // 1. No document detected – "Looking for document..."
  | 'detected'     // 2. Document detected – "Document detected"
  | 'partial'      // 3. Document partially visible – "Move document into frame"
  | 'too_far'      // 4. Document too far – "Move closer"
  | 'tilted'       // 5. Document tilted – "Align your document"
  | 'stable'       // 6. Document stable – "Hold still..."
  | 'ready';       // 7. Ready to capture – "Document ready"

const DETECTION_STATE_CONFIG: Record<
  DetectionState,
  { text: string; color: string; strokeColor: string; fillColor: string; dotColor: string }
> = {
  looking: {
    text: 'Looking for document...',
    color: '#CFD8DC',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.10)',
    dotColor: '#78909C',
  },
  detected: {
    text: 'Document detected',
    color: '#00E676',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.14)',
    dotColor: '#00E676',
  },
  partial: {
    text: 'Move document into frame',
    color: '#00E676',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.14)',
    dotColor: '#00E676',
  },
  too_far: {
    text: 'Move closer',
    color: '#00E676',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.14)',
    dotColor: '#00E676',
  },
  tilted: {
    text: 'Align your document',
    color: '#00E676',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.14)',
    dotColor: '#00E676',
  },
  stable: {
    text: 'Hold still...',
    color: '#00E676',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.18)',
    dotColor: '#00E676',
  },
  ready: {
    text: 'Document ready',
    color: '#00E676',
    strokeColor: '#00E676',
    fillColor: 'rgba(0, 230, 118, 0.22)',
    dotColor: '#00E676',
  },
};

interface ScannerScreenProps {
  navigation: any;
}

export interface ScannedPageItem {
  id: string;
  uri: string;
  originalUri?: string;
  rotationDeg: number;
  paperSize?: string;
  paperDimensions?: string;
  confidence?: number;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ navigation }) => {
  const cameraRef = useRef<InAppCameraRef>(null);

  // Top Bar State (Doc Scanner Images 1, 2, 3)
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [gridEnabled, setGridEnabled] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCropScreenAfterCapture, setShowCropScreenAfterCapture] = useState(true);

  // Mode Carousel (Doc Scanner Images 1, 2, 3, 5: Photo | ID Card | Document | Book | Signature)
  const [selectedMode, setSelectedMode] = useState<string>('Document');

  // Auto / Manual Capture Mode
  const [autoCapture, setAutoCapture] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState<string>('');
  const [lastDetectedPaper, setLastDetectedPaper] = useState<string>('A4 (210 × 297 mm)');

  // Real-Time Document Detection State (7 Detection States)
  const [detectionState, setDetectionState] = useState<DetectionState>('looking');
  const [detectedCorners, setDetectedCorners] = useState<DocumentCorners | null>(null);
  const [detectedPaperInfo, setDetectedPaperInfo] = useState<{
    size: string;
    confidence: number;
  } | null>(null);
  const [isSteady, setIsSteady] = useState<boolean>(false);
  const [viewLayout, setViewLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Developer Diagnostics Mode (Section 10)
  const [devDebugMode, setDevDebugMode] = useState<boolean>(false);
  const [devMetrics, setDevMetrics] = useState<{
    processingTimeMs: number;
    areaPercent: number;
  }>({ processingTimeMs: 6, areaPercent: 0 });

  const lastCornersRef = useRef<DocumentCorners | null>(null);
  const steadyFrameCountRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);
  const autoCaptureCooldownRef = useRef<number>(0);
  const activeCornersRef = useRef<DocumentCorners | null>(null);
  const activeSensorCornersRef = useRef<DocumentCorners | null>(null);

  // Multi-page batch state (Doc Scanner Image 5)
  const [batchPages, setBatchPages] = useState<ScannedPageItem[]>([]);

  // Corner adjustment modal state (Doc Scanner Image 4)
  const [cornerModalVisible, setCornerModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<DocumentAnalysisResult | null>(null);

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

  const processCapturedUri = useCallback(
    async (
      photoUri: string,
      corners?: DocumentCorners | null,
      isFromAuto: boolean = false
    ) => {
      setIsLoading(true);
      setAnalyzingStatus('Analyzing Document...');
      try {
        const analysis = await documentAnalysisService.analyzeAndCrop(photoUri, corners);
        setPendingAnalysis(analysis);
        setLastDetectedPaper(`${analysis.paperSize} (${analysis.paperDimensions})`);

        const effectiveUri = analysis.croppedUri || photoUri;

        if (isFromAuto) {
          // AUTO mode: Direct auto-crop to detected edges, bypass adjustment modal!
          // Add directly to batch tray and stay on camera for next page
          const newPage: ScannedPageItem = {
            id: `page_${Date.now()}_${batchPages.length + 1}`,
            uri: effectiveUri,
            originalUri: photoUri,
            rotationDeg: 0,
            paperSize: analysis.paperSize,
            paperDimensions: analysis.paperDimensions,
            confidence: analysis.confidence,
          };
          setBatchPages((prev) => [...prev, newPage]);
          setCornerModalVisible(false);
          setPendingImageUri(null);
          setPendingAnalysis(null);
          steadyFrameCountRef.current = 0;
          setIsSteady(false);
          autoCaptureCooldownRef.current = Date.now() + 2500;
        } else {
          // MANUAL mode: Open corner adjustment modal so user can drag and adjust
          setPendingImageUri(photoUri);
          setCornerModalVisible(true);
        }
      } catch (e: any) {
        console.warn('processCapturedUri analysis fallback:', e);
        if (isFromAuto) {
          const newPage: ScannedPageItem = {
            id: `page_${Date.now()}_${batchPages.length + 1}`,
            uri: photoUri,
            originalUri: photoUri,
            rotationDeg: 0,
            paperSize: 'A4',
            paperDimensions: '210 × 297 mm',
          };
          setBatchPages((prev) => [...prev, newPage]);
          setCornerModalVisible(false);
          steadyFrameCountRef.current = 0;
          setIsSteady(false);
          autoCaptureCooldownRef.current = Date.now() + 2500;
        } else {
          setPendingImageUri(photoUri);
          setCornerModalVisible(true);
        }
      } finally {
        setIsLoading(false);
        setAnalyzingStatus('');
        isCapturingRef.current = false;
      }
    },
    [batchPages.length]
  );

  const handleCapture = useCallback(
    async (sensorCornersToUse?: DocumentCorners | null, isFromAuto: boolean = false) => {
      if (isLoading) return;
      setIsLoading(true);
      isCapturingRef.current = true;

      try {
        if (cameraRef.current) {
          const photo = await cameraRef.current.capture();
          if (photo?.uri) {
            // Priority: direct sensor corners from capture, or passed sensor corners, or active sensor corners
            const effectiveCorners =
              photo.detectedCorners ||
              sensorCornersToUse ||
              activeSensorCornersRef.current ||
              null;
            await processCapturedUri(photo.uri, effectiveCorners, isFromAuto);
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
        isCapturingRef.current = false;
      }
    },
    [isLoading, processCapturedUri]
  );

  // Document Detection Stream Handler (Real-Time Dynamic Edge Detection)
  const handleDocumentDetected = useCallback(
    (event: any) => {
      if (!event.detected || !event.corners) {
        setDetectedCorners(null);
        setDetectedPaperInfo(null);
        setIsSteady(false);
        setDetectionState('looking');
        steadyFrameCountRef.current = 0;
        activeCornersRef.current = null;
        activeSensorCornersRef.current = null;
        return;
      }

      const { tl, tr, br, bl } = event.corners;
      const currentCorners: DocumentCorners = { tl, tr, br, bl };
      setDetectedCorners(currentCorners);
      activeCornersRef.current = currentCorners;

      // Extract sensor-space corners (for image cropping)
      if (event.sensorCorners) {
        activeSensorCornersRef.current = {
          tl: event.sensorCorners.tl,
          tr: event.sensorCorners.tr,
          br: event.sensorCorners.br,
          bl: event.sensorCorners.bl,
        };
      } else {
        activeSensorCornersRef.current = currentCorners;
      }

      setDetectedPaperInfo({
        size: event.paperSize || 'A4',
        confidence: event.confidence || 0.95,
      });

      // Margin clearance check (< 1% from viewfinder boundary)
      const isAtMargin =
        tl.x < 0.01 || tl.y < 0.01 ||
        tr.x > 0.99 || tr.y < 0.01 ||
        br.x > 0.99 || br.y > 0.99 ||
        bl.x < 0.01 || bl.y > 0.99;

      if (isAtMargin) {
        setDetectionState('partial');
        setIsSteady(false);
        steadyFrameCountRef.current = 0;
        lastCornersRef.current = currentCorners;
        return;
      }

      // Area calculation
      const quadArea = 0.5 * Math.abs(
        (tl.x * tr.y - tr.x * tl.y) +
        (tr.x * br.y - br.x * tr.y) +
        (br.x * bl.y - bl.x * br.y) +
        (bl.x * tl.y - tl.x * bl.y)
      );

      setDevMetrics({
        processingTimeMs: event.processingTimeMs || 6,
        areaPercent: Math.round(quadArea * 100),
      });

      // Document too far (< 8% of frame)
      if (quadArea < 0.08) {
        setDetectionState('too_far');
        setIsSteady(false);
        steadyFrameCountRef.current = 0;
        lastCornersRef.current = currentCorners;
        return;
      }

      // Tilt check
      const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
        Math.hypot(p1.x - p2.x, p1.y - p2.y);

      const topW = dist(tl, tr);
      const botW = dist(bl, br);
      const leftH = dist(tl, bl);
      const rightH = dist(tr, br);

      const ratioW = Math.max(topW, botW) / Math.max(0.01, Math.min(topW, botW));
      const ratioH = Math.max(leftH, rightH) / Math.max(0.01, Math.min(leftH, rightH));

      if (ratioW > 1.85 || ratioH > 1.85) {
        setDetectionState('tilted');
        setIsSteady(false);
        steadyFrameCountRef.current = 0;
        lastCornersRef.current = currentCorners;
        return;
      }

      // Tracking & Consecutive Frame Stability
      const last = lastCornersRef.current;
      let delta = 1.0;
      if (last) {
        delta =
          Math.abs(tl.x - last.tl.x) +
          Math.abs(tl.y - last.tl.y) +
          Math.abs(tr.x - last.tr.x) +
          Math.abs(tr.y - last.tr.y) +
          Math.abs(br.x - last.br.x) +
          Math.abs(br.y - last.br.y) +
          Math.abs(bl.x - last.bl.x) +
          Math.abs(bl.y - last.bl.y);
      }

      if (delta > 0.085) {
        // Document moving within viewfinder
        steadyFrameCountRef.current = 0;
        setIsSteady(false);
        setDetectionState('detected');
      } else {
        // Document stable across consecutive frames
        steadyFrameCountRef.current += 1;
        const count = steadyFrameCountRef.current;

        if (count < 2) {
          setDetectionState('detected');
          setIsSteady(false);
        } else if (count < 4) {
          setDetectionState('stable');
          setIsSteady(true);
        } else {
          // Document ready to capture - Green border locked!
          setDetectionState('ready');
          setIsSteady(true);

          // Intelligent Auto-Capture
          if (autoCapture && !isCapturingRef.current) {
            const now = Date.now();
            if (now >= autoCaptureCooldownRef.current) {
              autoCaptureCooldownRef.current = now + 3000;
              steadyFrameCountRef.current = 0;
              setIsSteady(false);
              handleCapture(activeSensorCornersRef.current, true /* isFromAuto */);
            }
          }
        }
      }

      lastCornersRef.current = currentCorners;
    },
    [autoCapture, handleCapture]
  );

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
        await processCapturedUri(firstAsset.uri, null, false /* manual adjustment */);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred while opening gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCorners = (
    corners: DocumentCorners,
    paperSize: PaperSize,
    croppedUri?: string,
    filterName?: string,
    docName?: string
  ) => {
    setCornerModalVisible(false);
    const finalUri = croppedUri || pendingAnalysis?.croppedUri || pendingImageUri;
    const finalPaper = paperSize || pendingAnalysis?.paperSize || 'A4';
    const finalDims = pendingAnalysis?.paperDimensions || '210 × 297 mm';

    if (finalUri) {
      const newPage: ScannedPageItem = {
        id: `page_${Date.now()}_${batchPages.length + 1}`,
        uri: finalUri,
        originalUri: pendingImageUri || finalUri,
        rotationDeg: 0,
        paperSize: finalPaper,
        paperDimensions: finalDims,
      };
      setBatchPages((prev) => [...prev, newPage]);
      setPendingImageUri(null);
      setPendingAnalysis(null);
      steadyFrameCountRef.current = 0;
      setIsSteady(false);
      autoCaptureCooldownRef.current = Date.now() + 2500;
      isCapturingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleDoneBatch = () => {
    if (batchPages.length === 0) {
      Alert.alert('No Pages', 'Please capture at least one page first.');
      return;
    }

    navigation.navigate('ScannerEdit', {
      pageUri: batchPages[0].uri,
      pageIndex: 1,
      paperSize: batchPages[0].paperSize || 'A4',
      paperDimensions: batchPages[0].paperDimensions || '210 × 297 mm',
      allPages: batchPages,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Camera Top Bar (Doc Scanner Images 1, 2, 3) */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topNavBtn}>
          <Text style={styles.topNavArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.topRightActions}>
          {/* Flash Mode Toggle (Auto / On / Off) */}
          <TouchableOpacity
            onPress={() => {
              if (flashMode === 'auto') setFlashMode('on');
              else if (flashMode === 'on') setFlashMode('off');
              else setFlashMode('auto');
            }}
            style={styles.topActionBtn}
          >
            <Text style={styles.topActionIcon}>
              {flashMode === 'auto' ? '⚡A' : flashMode === 'on' ? '⚡' : '⚡✕'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live In-App Camera Viewfinder */}
      <View
        style={styles.viewfinderWrapper}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setViewLayout({ width, height });
        }}
      >
        <InAppCamera
          ref={cameraRef}
          torchOn={flashMode === 'on'}
          style={StyleSheet.absoluteFill}
          onDocumentDetected={handleDocumentDetected}
        />

        {/* Developer Diagnostics HUD (Section 10) */}
        {devDebugMode && (
          <View style={styles.devDebugHud} pointerEvents="none">
            <Text style={styles.devDebugTitle}>⚡ OpenCV 4.5.3 Native CV</Text>
            <Text style={styles.devDebugText}>Latency: {devMetrics.processingTimeMs}ms (~15 FPS)</Text>
            <Text style={styles.devDebugText}>State: {detectionState.toUpperCase()}</Text>
            <Text style={styles.devDebugText}>Conf: {Math.round((detectedPaperInfo?.confidence || 0.95) * 100)}%</Text>
            <Text style={styles.devDebugText}>Paper: {detectedPaperInfo?.size || 'A4'} (Area: {devMetrics.areaPercent}%)</Text>
            {detectedCorners && (
              <Text style={styles.devDebugText}>
                TL:[{detectedCorners.tl.x.toFixed(2)},{detectedCorners.tl.y.toFixed(2)}] TR:[{detectedCorners.tr.x.toFixed(2)},{detectedCorners.tr.y.toFixed(2)}]
              </Text>
            )}
          </View>
        )}

        {/* 3x3 Rule-of-Thirds Grid Overlay */}
        {gridEnabled && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={styles.gridLineH1} />
            <View style={styles.gridLineH2} />
            <View style={styles.gridLineV1} />
            <View style={styles.gridLineV2} />
          </View>
        )}

        {/* Subtle Central Focus Reticle (Doc Scanner Images 1 & 2: [ o ]) */}
        <View style={styles.focusReticle} pointerEvents="none">
          <View style={[styles.focusBracket, styles.bracketTL]} />
          <View style={[styles.focusBracket, styles.bracketTR]} />
          <View style={[styles.focusBracket, styles.bracketBL]} />
          <View style={[styles.focusBracket, styles.bracketBR]} />
          <View style={styles.focusCenterCircle} />
        </View>

        {/* Real-time Dynamic Doc Scanner Paper Tracking Polygon & 4 Corner Indicators (Turns GREEN when ready!) */}
        {detectedCorners && viewLayout.width > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg style={StyleSheet.absoluteFill}>
              <Polygon
                points={
                  `${detectedCorners.tl.x * viewLayout.width},${detectedCorners.tl.y * viewLayout.height} ` +
                  `${detectedCorners.tr.x * viewLayout.width},${detectedCorners.tr.y * viewLayout.height} ` +
                  `${detectedCorners.br.x * viewLayout.width},${detectedCorners.br.y * viewLayout.height} ` +
                  `${detectedCorners.bl.x * viewLayout.width},${detectedCorners.bl.y * viewLayout.height}`
                }
                fill={DETECTION_STATE_CONFIG[detectionState].fillColor}
                stroke={DETECTION_STATE_CONFIG[detectionState].strokeColor}
                strokeWidth={detectionState === 'ready' ? 2.8 : 2}
                strokeLinejoin="round"
              />
              {/* 4 Corner Indicators */}
              {[
                detectedCorners.tl,
                detectedCorners.tr,
                detectedCorners.br,
                detectedCorners.bl,
              ].map((pt, idx) => (
                <Circle
                  key={idx}
                  cx={pt.x * viewLayout.width}
                  cy={pt.y * viewLayout.height}
                  r={detectionState === 'ready' ? 10 : 8}
                  fill={DETECTION_STATE_CONFIG[detectionState].strokeColor}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
              ))}
            </Svg>
          </View>
        )}

        {/* Center Capturing Progress Indicator (When in auto-capture ready/steady) */}
        {isSteady && autoCapture && (
          <View style={styles.capturingCenterArc} pointerEvents="none">
            <ActivityIndicator size="large" color={DETECTION_STATE_CONFIG[detectionState].strokeColor} />
          </View>
        )}

        {/* Floating Status Pill (Always visible across all 7 states: Looking, Detected, Move Closer, etc.) */}
        <View style={styles.floatingStatusPill} pointerEvents="none">
          <View
            style={[
              styles.statusDot,
              { backgroundColor: DETECTION_STATE_CONFIG[detectionState].dotColor },
            ]}
          />
          <Text
            style={[
              styles.floatingStatusText,
              { color: DETECTION_STATE_CONFIG[detectionState].color },
            ]}
          >
            {detectionState === 'stable' && autoCapture
              ? "Capturing... don't move"
              : DETECTION_STATE_CONFIG[detectionState].text}
          </Text>
        </View>

        {/* Viewfinder Loading Overlay during processing */}
        {isLoading && (
          <View style={styles.viewfinderOverlay} pointerEvents="auto">
            <View style={styles.captureLoadingBox}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.captureLoadingText}>{analyzingStatus || 'Processing capture...'}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Mode Carousel Bar (Doc Scanner Images 1, 2, 3, 5: Photo | ID Card | Document | Book | Signature) */}
      <View style={styles.modeCarouselContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeCarouselScroll}
        >
          {['Photo', 'ID Card', 'Document', 'Book', 'Signature'].map((mode) => {
            const isSelected = selectedMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={styles.modeTabBtn}
                onPress={() => setSelectedMode(mode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeTabText, isSelected && styles.modeTabTextActive]}>
                  {mode}
                </Text>
                {isSelected && <View style={styles.modeTabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Bottom Controls Bar (Doc Scanner Images 1, 2, 3, 5) */}
      <View style={styles.bottomControlsBar}>
        {/* Left Col: AUTO/MANUAL Toggle or Page Thumbnail (Doc Scanner Images 1 & 5) */}
        <View style={styles.bottomLeftCol}>
          {batchPages.length > 0 ? (
            <TouchableOpacity
              style={styles.lastThumbContainer}
              onPress={handleDoneBatch}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: batchPages[batchPages.length - 1].uri }}
                style={styles.lastThumbImg}
                resizeMode="cover"
              />
              <View style={styles.thumbPageBadge}>
                <Text style={styles.thumbPageBadgeText}>{batchPages.length}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* AUTO / MANUAL Toggle (Doc Scanner Images 1, 2, 3) */}
          <TouchableOpacity
            style={styles.autoManualBtn}
            onPress={() => setAutoCapture(!autoCapture)}
            activeOpacity={0.7}
          >
            <Text style={styles.autoManualIcon}>{autoCapture ? '⏱️' : '👆'}</Text>
            <Text style={styles.autoManualLabel}>{autoCapture ? 'AUTO' : 'MANUAL'}</Text>
          </TouchableOpacity>
        </View>

        {/* Center: Big Blue Circular Shutter Button with Camera Icon (Doc Scanner Images 1, 2, 3, 5) */}
        <TouchableOpacity
          style={styles.shutterOuterCircle}
          onPress={() => handleCapture(activeSensorCornersRef.current, false /* manual */)}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          <View style={styles.shutterInnerCircle}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.shutterCameraIcon}>📷</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Right Col: Done Checkmark Button (Doc Scanner Image 5) or Gallery */}
        <View style={styles.bottomRightCol}>
          {batchPages.length > 0 ? (
            <TouchableOpacity
              style={styles.doneCheckBtn}
              onPress={handleDoneBatch}
              activeOpacity={0.8}
            >
              <Text style={styles.doneCheckIcon}>✓</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.galleryBtn}
              onPress={handleGallery}
              activeOpacity={0.7}
            >
              <Text style={styles.galleryIcon}>🖼️</Text>
              <Text style={styles.galleryLabel}>Gallery</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Auto Crop & Paper Analysis Corner Adjustment Modal (Doc Scanner Image 4) */}
      {pendingImageUri ? (
        <CornerAdjustmentModal
          visible={cornerModalVisible}
          imageUri={pendingImageUri}
          initialAnalysis={pendingAnalysis}
          initialCorners={pendingAnalysis?.detectedCorners || activeSensorCornersRef.current || detectedCorners}
          onApply={handleApplyCorners}
          onCancel={() => {
            setCornerModalVisible(false);
            setPendingImageUri(null);
            setPendingAnalysis(null);
          }}
          onRetake={() => {
            setCornerModalVisible(false);
            setPendingImageUri(null);
            setPendingAnalysis(null);
          }}
        />
      ) : null}

      {/* Settings Modal (Doc Scanner Option) */}
      <Modal visible={showSettingsModal} transparent animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <View style={styles.settingsModalCard}>
            <Text style={styles.settingsModalTitle}>Scanner Settings</Text>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setShowCropScreenAfterCapture(!showCropScreenAfterCapture)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsRowTitle}>Show crop screen after every capture</Text>
                <Text style={styles.settingsRowSub}>Allows manual border adjustment on each page</Text>
              </View>
              <View style={[styles.settingsToggleBox, showCropScreenAfterCapture && styles.settingsToggleActive]}>
                {showCropScreenAfterCapture && <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>✓</Text>}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsCloseBtn}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.settingsCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 10,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  topNavBtn: {
    padding: 6,
  },
  topNavArrow: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  topActionBtn: {
    padding: 6,
  },
  topActionActive: {
    borderRadius: 4,
  },
  topActionIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  },
  // 3x3 Grid Lines
  gridLineH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  gridLineH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.66%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  gridLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  gridLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.66%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  // Center Focus Reticle (Doc Scanner Images 1 & 2: [ o ])
  focusReticle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -35,
    marginTop: -35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusBracket: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 5,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 5,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 5,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 5,
  },
  focusCenterCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  // Developer Diagnostics HUD (Section 10)
  devDebugHud: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
    zIndex: 50,
  },
  devDebugTitle: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  devDebugText: {
    color: '#ECEFF1',
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  // Capturing Center Arc (Doc Scanner Image 3)
  capturingCenterArc: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -25,
    marginTop: -25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  // Floating Status Pill (7 Real-Time States with Dynamic Dot & Colors)
  floatingStatusPill: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 25, 0.88)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    zIndex: 25,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  floatingStatusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  captureLoadingBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  captureLoadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  // Mode Carousel Bar (Doc Scanner Images 1, 2, 3, 5: Photo | ID Card | Document | Book | Signature)
  modeCarouselContainer: {
    height: 44,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  modeCarouselScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modeTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#00A3FF',
    fontWeight: '700',
  },
  modeTabIndicator: {
    width: 24,
    height: 2.5,
    backgroundColor: '#00A3FF',
    borderRadius: 1.5,
    marginTop: 3,
  },
  // Bottom Controls Bar (Doc Scanner Images 1, 2, 3, 5)
  bottomControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#000000',
  },
  bottomLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
  },
  lastThumbContainer: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#00A3FF',
    marginRight: 10,
  },
  lastThumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPageBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#00A3FF',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  autoManualBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoManualIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  autoManualLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Big Blue Shutter Button (Doc Scanner Images 1, 2, 3, 5)
  shutterOuterCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 163, 255, 0.25)',
    borderWidth: 2,
    borderColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  shutterCameraIcon: {
    fontSize: 26,
  },
  bottomRightCol: {
    width: 90,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  doneCheckBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A3FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  doneCheckIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  galleryBtn: {
    alignItems: 'center',
  },
  galleryIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  galleryLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },
  // Settings Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  settingsModalCard: {
    width: '100%',
    backgroundColor: '#1E1E28',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  settingsModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  settingsRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsRowSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  settingsToggleBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  settingsToggleActive: {
    backgroundColor: '#00A3FF',
  },
  settingsCloseBtn: {
    backgroundColor: '#00A3FF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
  },
  settingsCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

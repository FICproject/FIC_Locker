import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
  PanResponder,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Polygon, Line } from 'react-native-svg';
import { colors, typography, borderRadius } from '../../theme';
import {
  documentAnalysisService,
  PaperSize,
  PAPER_SPECS,
  DocumentAnalysisResult,
} from '../../services/documentAnalysisService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 28;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.56;

export interface CornerPoint {
  x: number;
  y: number;
}

export interface DocumentCorners {
  tl: CornerPoint;
  tr: CornerPoint;
  br: CornerPoint;
  bl: CornerPoint;
}

interface CornerAdjustmentModalProps {
  visible: boolean;
  imageUri: string;
  initialAnalysis?: DocumentAnalysisResult | null;
  initialCorners?: DocumentCorners | null;
  documentTitle?: string;
  onApply: (
    corners: DocumentCorners,
    paperSize: PaperSize,
    croppedUri?: string,
    filterName?: string,
    docName?: string
  ) => void;
  onCancel: () => void;
  onRetake?: () => void;
}

export const CornerAdjustmentModal: React.FC<CornerAdjustmentModalProps> = ({
  visible,
  imageUri,
  initialAnalysis,
  initialCorners,
  documentTitle = 'New Document',
  onApply,
  onCancel,
  onRetake,
}) => {
  const [canvasDims, setCanvasDims] = useState<{ width: number; height: number }>({
    width: CANVAS_WIDTH,
    height: Math.round(SCREEN_HEIGHT * 0.74),
  });
  const canvasDimsRef = useRef({
    width: CANVAS_WIDTH,
    height: Math.round(SCREEN_HEIGHT * 0.74),
  });

  const defaultCorners = (dims = canvasDimsRef.current): DocumentCorners => ({
    tl: { x: dims.width * 0.08, y: dims.height * 0.08 },
    tr: { x: dims.width * 0.92, y: dims.height * 0.08 },
    br: { x: dims.width * 0.92, y: dims.height * 0.92 },
    bl: { x: dims.width * 0.08, y: dims.height * 0.92 },
  });

  const [corners, setCorners] = useState<DocumentCorners>(defaultCorners());
  const cornersRef = useRef<DocumentCorners>(corners);
  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(initialAnalysis?.paperSize || 'A4');
  const [analysis, setAnalysis] = useState<DocumentAnalysisResult | null>(initialAnalysis || null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [currentFilter, setCurrentFilter] = useState<string>('VIVID LIGHT');
  const [docName, setDocName] = useState<string>(documentTitle);
  const [showCropScreenAlways, setShowCropScreenAlways] = useState<boolean>(true);
  const [showFilterPicker, setShowFilterPicker] = useState<boolean>(false);
  const [showPresetPicker, setShowPresetPicker] = useState<boolean>(false);

  useEffect(() => {
    if (visible && imageUri) {
      Image.getSize(
        imageUri,
        (imgW, imgH) => {
          const maxW = SCREEN_WIDTH - 28;
          const maxH = Math.round(SCREEN_HEIGHT * 0.74);
          const aspect = imgW / imgH;
          let cW = maxW;
          let cH = cW / aspect;
          if (cH > maxH) {
            cH = maxH;
            cW = cH * aspect;
          }
          const dims = { width: Math.round(cW), height: Math.round(cH) };
          setCanvasDims(dims);
          canvasDimsRef.current = dims;

          // Check if initialCorners are valid and not hugging edge
          const isAtEdge =
            initialCorners &&
            (initialCorners.tl.x <= 0.06 ||
              initialCorners.tl.y <= 0.06 ||
              initialCorners.tr.x >= 0.94 ||
              initialCorners.br.y >= 0.94);

          if (initialCorners && !isAtEdge) {
            setCorners({
              tl: { x: initialCorners.tl.x * dims.width, y: initialCorners.tl.y * dims.height },
              tr: { x: initialCorners.tr.x * dims.width, y: initialCorners.tr.y * dims.height },
              br: { x: initialCorners.br.x * dims.width, y: initialCorners.br.y * dims.height },
              bl: { x: initialCorners.bl.x * dims.width, y: initialCorners.bl.y * dims.height },
            });
          } else {
            runAutoAnalysis(dims);
          }
        },
        () => {
          const dims = { width: CANVAS_WIDTH, height: Math.round(SCREEN_HEIGHT * 0.74) };
          setCanvasDims(dims);
          canvasDimsRef.current = dims;
          runAutoAnalysis(dims);
        }
      );

      if (initialAnalysis) {
        setAnalysis(initialAnalysis);
        setSelectedPaper(initialAnalysis.paperSize);
      }
    }
  }, [visible, imageUri]);

  const applyBoundsToCorners = (
    bounds: { left: number; top: number; right: number; bottom: number },
    dims = canvasDimsRef.current
  ) => {
    setCorners({
      tl: { x: bounds.left * dims.width, y: bounds.top * dims.height },
      tr: { x: bounds.right * dims.width, y: bounds.top * dims.height },
      br: { x: bounds.right * dims.width, y: bounds.bottom * dims.height },
      bl: { x: bounds.left * dims.width, y: bounds.bottom * dims.height },
    });
  };

  const runAutoAnalysis = async (dims = canvasDimsRef.current) => {
    if (!imageUri) return;
    setIsAnalyzing(true);
    try {
      const cornerResult = await documentAnalysisService.detectDocumentCorners(imageUri);
      if (cornerResult.detected && cornerResult.corners) {
        setCorners({
          tl: { x: cornerResult.corners.tl.x * dims.width, y: cornerResult.corners.tl.y * dims.height },
          tr: { x: cornerResult.corners.tr.x * dims.width, y: cornerResult.corners.tr.y * dims.height },
          br: { x: cornerResult.corners.br.x * dims.width, y: cornerResult.corners.br.y * dims.height },
          bl: { x: cornerResult.corners.bl.x * dims.width, y: cornerResult.corners.bl.y * dims.height },
        });
        if (cornerResult.paperSize) setSelectedPaper(cornerResult.paperSize);
      } else {
        const res = await documentAnalysisService.analyzeAndCrop(imageUri);
        setAnalysis(res);
        setSelectedPaper(res.paperSize);
        if (res.detectedCorners) {
          setCorners({
            tl: { x: res.detectedCorners.tl.x * dims.width, y: res.detectedCorners.tl.y * dims.height },
            tr: { x: res.detectedCorners.tr.x * dims.width, y: res.detectedCorners.tr.y * dims.height },
            br: { x: res.detectedCorners.br.x * dims.width, y: res.detectedCorners.br.y * dims.height },
            bl: { x: res.detectedCorners.bl.x * dims.width, y: res.detectedCorners.bl.y * dims.height },
          });
        } else {
          applyBoundsToCorners(res.normalizedBounds, dims);
        }
      }
    } catch (e) {
      setCorners(defaultCorners(dims));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyPaperPreset = (preset: PaperSize) => {
    setSelectedPaper(preset);
    if (preset === 'Custom') return;

    const spec = PAPER_SPECS[preset];
    const targetRatio = spec.ratio; // height / width
    const dims = canvasDimsRef.current;

    let boxW = dims.width * 0.86;
    let boxH = boxW * targetRatio;
    if (boxH > dims.height * 0.92) {
      boxH = dims.height * 0.92;
      boxW = boxH / targetRatio;
    }

    const left = (dims.width - boxW) / 2;
    const top = (dims.height - boxH) / 2;
    const right = left + boxW;
    const bottom = top + boxH;

    setCorners({
      tl: { x: left, y: top },
      tr: { x: right, y: top },
      br: { x: right, y: bottom },
      bl: { x: left, y: bottom },
    });
  };

  // Ref to store corner positions when drag gesture begins
  const dragStartRef = useRef<DocumentCorners | null>(null);

  // 4 Corner PanResponders (Smooth 1:1 real-time finger tracking)
  const createCornerPanResponder = (key: 'tl' | 'tr' | 'br' | 'bl') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveHandle(key);
        dragStartRef.current = {
          tl: { ...cornersRef.current.tl },
          tr: { ...cornersRef.current.tr },
          br: { ...cornersRef.current.br },
          bl: { ...cornersRef.current.bl },
        };
      },
      onPanResponderMove: (_, gestureState) => {
        const start = dragStartRef.current;
        if (!start) return;

        const startPt = start[key];
        const newX = Math.max(0, Math.min(canvasDimsRef.current.width, startPt.x + gestureState.dx));
        const newY = Math.max(0, Math.min(canvasDimsRef.current.height, startPt.y + gestureState.dy));

        setCorners((prev) => {
          const next = {
            ...prev,
            [key]: { x: newX, y: newY },
          };
          cornersRef.current = next;
          return next;
        });
      },
      onPanResponderRelease: () => {
        setActiveHandle(null);
        dragStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        setActiveHandle(null);
        dragStartRef.current = null;
      },
    });

  // 4 Edge PanResponders (Top, Right, Bottom, Left - whole-edge dragging)
  const createEdgePanResponder = (edge: 'top' | 'right' | 'bottom' | 'left') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveHandle(edge);
        dragStartRef.current = {
          tl: { ...cornersRef.current.tl },
          tr: { ...cornersRef.current.tr },
          br: { ...cornersRef.current.br },
          bl: { ...cornersRef.current.bl },
        };
      },
      onPanResponderMove: (_, gestureState) => {
        const start = dragStartRef.current;
        if (!start) return;

        if (edge === 'top') {
          const dy = gestureState.dy;
          const newY_tl = Math.max(0, Math.min(start.bl.y - 20, start.tl.y + dy));
          const newY_tr = Math.max(0, Math.min(start.br.y - 20, start.tr.y + dy));
          setCorners((prev) => {
            const next = {
              ...prev,
              tl: { ...prev.tl, y: newY_tl },
              tr: { ...prev.tr, y: newY_tr },
            };
            cornersRef.current = next;
            return next;
          });
        } else if (edge === 'bottom') {
          const dy = gestureState.dy;
          const newY_bl = Math.min(canvasDimsRef.current.height, Math.max(start.tl.y + 20, start.bl.y + dy));
          const newY_br = Math.min(canvasDimsRef.current.height, Math.max(start.tr.y + 20, start.br.y + dy));
          setCorners((prev) => {
            const next = {
              ...prev,
              bl: { ...prev.bl, y: newY_bl },
              br: { ...prev.br, y: newY_br },
            };
            cornersRef.current = next;
            return next;
          });
        } else if (edge === 'left') {
          const dx = gestureState.dx;
          const newX_tl = Math.max(0, Math.min(start.tr.x - 20, start.tl.x + dx));
          const newX_bl = Math.max(0, Math.min(start.br.x - 20, start.bl.x + dx));
          setCorners((prev) => {
            const next = {
              ...prev,
              tl: { ...prev.tl, x: newX_tl },
              bl: { ...prev.bl, x: newX_bl },
            };
            cornersRef.current = next;
            return next;
          });
        } else if (edge === 'right') {
          const dx = gestureState.dx;
          const newX_tr = Math.min(canvasDimsRef.current.width, Math.max(start.tl.x + 20, start.tr.x + dx));
          const newX_br = Math.min(canvasDimsRef.current.width, Math.max(start.bl.x + 20, start.br.x + dx));
          setCorners((prev) => {
            const next = {
              ...prev,
              tr: { ...prev.tr, x: newX_tr },
              br: { ...prev.br, x: newX_br },
            };
            cornersRef.current = next;
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        setActiveHandle(null);
        dragStartRef.current = null;
      },
      onPanResponderTerminate: () => {
        setActiveHandle(null);
        dragStartRef.current = null;
      },
    });

  const tlPan = useRef(createCornerPanResponder('tl')).current;
  const trPan = useRef(createCornerPanResponder('tr')).current;
  const brPan = useRef(createCornerPanResponder('br')).current;
  const blPan = useRef(createCornerPanResponder('bl')).current;

  const topEdgePan = useRef(createEdgePanResponder('top')).current;
  const rightEdgePan = useRef(createEdgePanResponder('right')).current;
  const bottomEdgePan = useRef(createEdgePanResponder('bottom')).current;
  const leftEdgePan = useRef(createEdgePanResponder('left')).current;

  const polygonPoints = `${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`;

  // Midpoint coordinates for the 4 Edge Pill Handles
  const midTop = { x: (corners.tl.x + corners.tr.x) / 2, y: (corners.tl.y + corners.tr.y) / 2 };
  const midRight = { x: (corners.tr.x + corners.br.x) / 2, y: (corners.tr.y + corners.br.y) / 2 };
  const midBottom = { x: (corners.bl.x + corners.br.x) / 2, y: (corners.bl.y + corners.br.y) / 2 };
  const midLeft = { x: (corners.tl.x + corners.bl.x) / 2, y: (corners.tl.y + corners.bl.y) / 2 };

  const handleRotate = () => {
    setRotationDeg((prev) => (prev + 90) % 360);
  };

  const handleEditDocName = () => {
    Alert.prompt
      ? Alert.prompt('Document Name', 'Enter a name for this document', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK', onPress: (text) => text && setDocName(text) },
        ])
      : Alert.alert('Doc Name', `Current name: ${docName}`);
  };

  const handleContinue = async () => {
    setIsAnalyzing(true);
    try {
      const cw = canvasDimsRef.current.width;
      const ch = canvasDimsRef.current.height;
      const normCorners: DocumentCorners = {
        tl: { x: Math.max(0, Math.min(1, corners.tl.x / cw)), y: Math.max(0, Math.min(1, corners.tl.y / ch)) },
        tr: { x: Math.max(0, Math.min(1, corners.tr.x / cw)), y: Math.max(0, Math.min(1, corners.tr.y / ch)) },
        br: { x: Math.max(0, Math.min(1, corners.br.x / cw)), y: Math.max(0, Math.min(1, corners.br.y / ch)) },
        bl: { x: Math.max(0, Math.min(1, corners.bl.x / cw)), y: Math.max(0, Math.min(1, corners.bl.y / ch)) },
      };
      const result = await documentAnalysisService.analyzeAndCrop(imageUri, normCorners, selectedPaper);
      onApply(normCorners, selectedPaper, result.croppedUri, currentFilter, docName);
    } catch {
      onApply(corners, selectedPaper, analysis?.croppedUri, currentFilter, docName);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filterOptions = [
    'VIVID LIGHT',
    'MAGIC COLOR',
    'ORIGINAL',
    'B&W CRISP',
    'GRAYSCALE',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Viewport Canvas with Bounding Guides & Pill Handles (Doc Scanner Image 4) */}
        <View style={[styles.canvasContainer, { width: canvasDims.width, height: canvasDims.height }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.documentImage,
                { width: canvasDims.width, height: canvasDims.height, transform: [{ rotate: `${rotationDeg}deg` }] },
              ]}
              resizeMode="cover"
            />
          ) : null}

          {/* SVG Crop Polygon & Edge Guides (Doc Scanner Cyan Theme) */}
          <Svg style={StyleSheet.absoluteFillObject} width={canvasDims.width} height={canvasDims.height}>
            <Polygon
              points={polygonPoints}
              fill="rgba(0, 229, 255, 0.14)"
              stroke="#00E5FF"
              strokeWidth="2.5"
            />
            {/* Direct outline lines */}
            <Line x1={corners.tl.x} y1={corners.tl.y} x2={corners.tr.x} y2={corners.tr.y} stroke="#00E5FF" strokeWidth="2" />
            <Line x1={corners.tr.x} y1={corners.tr.y} x2={corners.br.x} y2={corners.br.y} stroke="#00E5FF" strokeWidth="2" />
            <Line x1={corners.br.x} y1={corners.br.y} x2={corners.bl.x} y2={corners.bl.y} stroke="#00E5FF" strokeWidth="2" />
            <Line x1={corners.bl.x} y1={corners.bl.y} x2={corners.tl.x} y2={corners.tl.y} stroke="#00E5FF" strokeWidth="2" />
          </Svg>

          {/* 4 Corner Rings (Doc Scanner Style: Cyan Ring with Center White Dot) */}
          <View
            style={[styles.cornerRingContainer, { left: corners.tl.x - 28, top: corners.tl.y - 28 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...tlPan.panHandlers}
          >
            <View style={[styles.cornerRing, activeHandle === 'tl' && styles.cornerRingActive]}>
              <View style={styles.cornerInnerDot} />
            </View>
          </View>

          <View
            style={[styles.cornerRingContainer, { left: corners.tr.x - 28, top: corners.tr.y - 28 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...trPan.panHandlers}
          >
            <View style={[styles.cornerRing, activeHandle === 'tr' && styles.cornerRingActive]}>
              <View style={styles.cornerInnerDot} />
            </View>
          </View>

          <View
            style={[styles.cornerRingContainer, { left: corners.br.x - 28, top: corners.br.y - 28 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...brPan.panHandlers}
          >
            <View style={[styles.cornerRing, activeHandle === 'br' && styles.cornerRingActive]}>
              <View style={styles.cornerInnerDot} />
            </View>
          </View>

          <View
            style={[styles.cornerRingContainer, { left: corners.bl.x - 28, top: corners.bl.y - 28 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...blPan.panHandlers}
          >
            <View style={[styles.cornerRing, activeHandle === 'bl' && styles.cornerRingActive]}>
              <View style={styles.cornerInnerDot} />
            </View>
          </View>

          {/* 4 Mid-Edge Pill Handles (Doc Scanner Image 4: Top, Right, Bottom, Left) */}
          {/* Top Pill Handle */}
          <View
            style={[styles.edgePillHContainer, { left: midTop.x - 28, top: midTop.y - 20 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...topEdgePan.panHandlers}
          >
            <View style={[styles.edgePillH, activeHandle === 'top' && styles.edgePillActive]} />
          </View>

          {/* Bottom Pill Handle */}
          <View
            style={[styles.edgePillHContainer, { left: midBottom.x - 28, top: midBottom.y - 20 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...bottomEdgePan.panHandlers}
          >
            <View style={[styles.edgePillH, activeHandle === 'bottom' && styles.edgePillActive]} />
          </View>

          {/* Left Pill Handle */}
          <View
            style={[styles.edgePillVContainer, { left: midLeft.x - 20, top: midLeft.y - 28 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...leftEdgePan.panHandlers}
          >
            <View style={[styles.edgePillV, activeHandle === 'left' && styles.edgePillActive]} />
          </View>

          {/* Right Pill Handle */}
          <View
            style={[styles.edgePillVContainer, { left: midRight.x - 20, top: midRight.y - 28 }]}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...rightEdgePan.panHandlers}
          >
            <View style={[styles.edgePillV, activeHandle === 'right' && styles.edgePillActive]} />
          </View>
        </View>

        {/* Bottom Action Buttons: [ RETAKE ] and [ CONTINUE ] */}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={() => {
              onCancel();
              onRetake?.();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeBtnText}>RETAKE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 16,
  },
  canvasContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    alignSelf: 'center',
    backgroundColor: '#111116',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  cornerRingContainer: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  cornerRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerRingActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.25 }],
  },
  cornerInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  edgePillHContainer: {
    position: 'absolute',
    width: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  edgePillH: {
    width: 36,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#00A3FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  edgePillVContainer: {
    position: 'absolute',
    width: 40,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  edgePillV: {
    width: 12,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#00A3FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  edgePillActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
  },
  guidancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 30, 36, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  guidanceIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  guidanceText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  filterPromptLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginRight: 8,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C28',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterDropdownText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginRight: 6,
  },
  filterDropdownArrow: {
    color: '#00E5FF',
    fontSize: 12,
  },
  filterPickerDropdown: {
    backgroundColor: '#1E1E2C',
    marginHorizontal: 32,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 4,
    zIndex: 50,
  },
  filterOptionItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  filterOptionItemActive: {
    backgroundColor: 'rgba(0, 163, 255, 0.15)',
  },
  filterOptionText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  filterOptionTextActive: {
    color: '#00A3FF',
    fontWeight: '700',
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 32,
  },
  actionToolBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  actionToolIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  actionToolLabel: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  presetPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  presetChip: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    margin: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  presetChipActive: {
    backgroundColor: '#00A3FF',
    borderColor: '#00A3FF',
  },
  presetChipText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  settingGearIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  settingToggleText: {
    color: '#00A3FF',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  settingCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#00A3FF',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCheckboxChecked: {
    backgroundColor: '#00A3FF',
  },
  settingCheckmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    marginTop: 'auto',
    marginBottom: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#4B5563',
    backgroundColor: '#1E1E28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  continueBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#00A3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

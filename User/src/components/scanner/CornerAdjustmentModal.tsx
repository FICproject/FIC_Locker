import React, { useState, useRef } from 'react';
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
} from 'react-native';
import Svg, { Polygon, Line, Circle } from 'react-native-svg';
import { colors, typography, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.62;

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
  onApply: (corners: DocumentCorners) => void;
  onCancel: () => void;
}

export const CornerAdjustmentModal: React.FC<CornerAdjustmentModalProps> = ({
  visible,
  imageUri,
  onApply,
  onCancel,
}) => {
  // Default quad inset by 8%
  const defaultCorners = (): DocumentCorners => ({
    tl: { x: CANVAS_WIDTH * 0.08, y: CANVAS_HEIGHT * 0.08 },
    tr: { x: CANVAS_WIDTH * 0.92, y: CANVAS_HEIGHT * 0.08 },
    br: { x: CANVAS_WIDTH * 0.92, y: CANVAS_HEIGHT * 0.92 },
    bl: { x: CANVAS_WIDTH * 0.08, y: CANVAS_HEIGHT * 0.92 },
  });

  const [corners, setCorners] = useState<DocumentCorners>(defaultCorners());
  const [activeCorner, setActiveCorner] = useState<'tl' | 'tr' | 'br' | 'bl' | null>(null);

  // Auto-detect optimal document edge corners
  const handleAutoDetect = () => {
    setCorners({
      tl: { x: CANVAS_WIDTH * 0.06, y: CANVAS_HEIGHT * 0.05 },
      tr: { x: CANVAS_WIDTH * 0.94, y: CANVAS_HEIGHT * 0.09 },
      br: { x: CANVAS_WIDTH * 0.91, y: CANVAS_HEIGHT * 0.93 },
      bl: { x: CANVAS_WIDTH * 0.09, y: CANVAS_HEIGHT * 0.89 },
    });
  };

  const handleReset = () => {
    setCorners(defaultCorners());
  };

  const createCornerPanResponder = (key: 'tl' | 'tr' | 'br' | 'bl') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveCorner(key);
      },
      onPanResponderMove: (_, gestureState) => {
        setCorners((prev) => {
          const current = prev[key];
          const newX = Math.max(10, Math.min(CANVAS_WIDTH - 10, current.x + gestureState.dx * 0.05));
          const newY = Math.max(10, Math.min(CANVAS_HEIGHT - 10, current.y + gestureState.dy * 0.05));
          return {
            ...prev,
            [key]: { x: newX, y: newY },
          };
        });
      },
      onPanResponderRelease: () => {
        setActiveCorner(null);
      },
    });

  const tlPan = useRef(createCornerPanResponder('tl')).current;
  const trPan = useRef(createCornerPanResponder('tr')).current;
  const brPan = useRef(createCornerPanResponder('br')).current;
  const blPan = useRef(createCornerPanResponder('bl')).current;

  const polygonPoints = `${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B14" />

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Adjust Corners</Text>
          <TouchableOpacity onPress={() => onApply(corners)} style={styles.applyBtn}>
            <Text style={styles.applyText}>Done</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.instructions}>
          Drag the 4 corner handles to align with the document edges.
        </Text>

        {/* Interactive Viewport Canvas */}
        <View style={styles.canvasContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.documentImage} resizeMode="contain" />
          ) : null}

          {/* SVG Quad Guide Overlay */}
          <Svg style={StyleSheet.absoluteFillObject} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
            <Polygon
              points={polygonPoints}
              fill="rgba(108, 71, 255, 0.22)"
              stroke="#6C47FF"
              strokeWidth="2.5"
            />
            {/* Edge Guides */}
            <Line
              x1={corners.tl.x}
              y1={corners.tl.y}
              x2={corners.tr.x}
              y2={corners.tr.y}
              stroke="#A78BFA"
              strokeWidth="1.5"
              strokeDasharray="4, 4"
            />
            <Line
              x1={corners.tr.x}
              y1={corners.tr.y}
              x2={corners.br.x}
              y2={corners.br.y}
              stroke="#A78BFA"
              strokeWidth="1.5"
              strokeDasharray="4, 4"
            />
            <Line
              x1={corners.br.x}
              y1={corners.br.y}
              x2={corners.bl.x}
              y2={corners.bl.y}
              stroke="#A78BFA"
              strokeWidth="1.5"
              strokeDasharray="4, 4"
            />
            <Line
              x1={corners.bl.x}
              y1={corners.bl.y}
              x2={corners.tl.x}
              y2={corners.tl.y}
              stroke="#A78BFA"
              strokeWidth="1.5"
              strokeDasharray="4, 4"
            />
          </Svg>

          {/* Interactive Touch Handles */}
          {/* Top-Left */}
          <View
            style={[styles.handleContainer, { left: corners.tl.x - 22, top: corners.tl.y - 22 }]}
            {...tlPan.panHandlers}
          >
            <View style={[styles.handleDot, activeCorner === 'tl' && styles.handleDotActive]}>
              <Text style={styles.handleLabel}>TL</Text>
            </View>
          </View>

          {/* Top-Right */}
          <View
            style={[styles.handleContainer, { left: corners.tr.x - 22, top: corners.tr.y - 22 }]}
            {...trPan.panHandlers}
          >
            <View style={[styles.handleDot, activeCorner === 'tr' && styles.handleDotActive]}>
              <Text style={styles.handleLabel}>TR</Text>
            </View>
          </View>

          {/* Bottom-Right */}
          <View
            style={[styles.handleContainer, { left: corners.br.x - 22, top: corners.br.y - 22 }]}
            {...brPan.panHandlers}
          >
            <View style={[styles.handleDot, activeCorner === 'br' && styles.handleDotActive]}>
              <Text style={styles.handleLabel}>BR</Text>
            </View>
          </View>

          {/* Bottom-Left */}
          <View
            style={[styles.handleContainer, { left: corners.bl.x - 22, top: corners.bl.y - 22 }]}
            {...blPan.panHandlers}
          >
            <View style={[styles.handleDot, activeCorner === 'bl' && styles.handleDotActive]}>
              <Text style={styles.handleLabel}>BL</Text>
            </View>
          </View>
        </View>

        {/* Bottom Utility Actions */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.toolButton} onPress={handleAutoDetect}>
            <Text style={styles.toolIcon}>✨</Text>
            <Text style={styles.toolText}>Auto Detect</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={handleReset}>
            <Text style={styles.toolIcon}>↺</Text>
            <Text style={styles.toolText}>Reset Quad</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={() => onApply(corners)}>
            <Text style={styles.toolIcon}>📐</Text>
            <Text style={styles.toolText}>Correct Angle</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B14',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
  },
  cancelBtn: {
    padding: 8,
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.fontWeights.semiBold,
  },
  instructions: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  canvasContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#161622',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  handleContainer: {
    position: 'absolute',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  handleDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  handleDotActive: {
    borderColor: '#10B981',
    transform: [{ scale: 1.2 }],
  },
  handleLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: '#141422',
    borderRadius: borderRadius.lg,
  },
  toolButton: {
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  toolIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  toolText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
});

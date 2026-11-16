import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD_WIDTH = SCREEN_WIDTH - 40;
const PAD_HEIGHT = 220;

interface Point {
  x: number;
  y: number;
}

interface SignatureModalProps {
  visible: boolean;
  onSave: (signatureUri: string) => void;
  onCancel: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ visible, onSave, onCancel }) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [strokeColor, setStrokeColor] = useState<string>('#111827');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const currentPathRef = useRef<string>('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current = startPoint;
        setCurrentPath(startPoint);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newSegment = `${currentPathRef.current} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current = newSegment;
        setCurrentPath(newSegment);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setPaths((prev) => [...prev, currentPathRef.current]);
          currentPathRef.current = '';
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    currentPathRef.current = '';
  };

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleSaveDrawn = () => {
    if (paths.length === 0) {
      Alert.alert('Empty Signature', 'Please draw your signature before saving.');
      return;
    }

    // Convert SVG paths to data URI representation
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD_WIDTH}" height="${PAD_HEIGHT}" viewBox="0 0 ${PAD_WIDTH} ${PAD_HEIGHT}"><rect width="100%" height="100%" fill="none"/>${paths.map((p) => `<path d="${p}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;

    onSave(dataUri);
    handleClear();
  };

  const handleUploadFromGallery = async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
      if (res.assets && res.assets[0]?.uri) {
        onSave(res.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message || 'Failed to select signature image.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Digital Signature</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Color & Pen Width Palette */}
          <View style={styles.paletteRow}>
            <View style={styles.colorGroup}>
              {['#111827', '#1E40AF', '#6C47FF'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    strokeColor === color && styles.colorDotActive,
                  ]}
                  onPress={() => setStrokeColor(color)}
                />
              ))}
            </View>

            <View style={styles.widthGroup}>
              {[2, 3, 5].map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.widthBtn, strokeWidth === w && styles.widthBtnActive]}
                  onPress={() => setStrokeWidth(w)}
                >
                  <View style={[styles.widthIndicator, { height: w }]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interactive Touch Drawing Pad */}
          <View style={styles.padWrapper} {...panResponder.panHandlers}>
            <Svg width={PAD_WIDTH} height={PAD_HEIGHT} style={styles.svgPad}>
              {paths.map((p, idx) => (
                <Path
                  key={idx}
                  d={p}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
            </Svg>

            {paths.length === 0 && !currentPath && (
              <View style={styles.padPlaceholder} pointerEvents="none">
                <Text style={styles.placeholderLine}>✍️ Sign here with your finger</Text>
                <View style={styles.signatureBaseline} />
              </View>
            )}
          </View>

          {/* Pad Tools (Undo, Clear, Upload) */}
          <View style={styles.toolRow}>
            <TouchableOpacity style={styles.toolBtn} onPress={handleUndo}>
              <Text style={styles.toolBtnText}>↩ Undo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={handleClear}>
              <Text style={styles.toolBtnText}>🗑️ Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={handleUploadFromGallery}>
              <Text style={styles.toolBtnText}>🖼️ Upload Image</Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelAction} onPress={onCancel}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveAction} onPress={handleSaveDrawn}>
              <Text style={styles.saveActionText}>Apply Signature</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  paletteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#9333EA',
    transform: [{ scale: 1.15 }],
  },
  widthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  widthBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  widthBtnActive: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  widthIndicator: {
    width: 18,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  padWrapper: {
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  svgPad: {
    width: '100%',
    height: '100%',
  },
  padPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderLine: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 30,
  },
  signatureBaseline: {
    position: 'absolute',
    bottom: 45,
    width: '80%',
    height: 1,
    backgroundColor: '#D8B4FE',
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingVertical: 4,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toolBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelAction: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelActionText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  saveAction: {
    flex: 1.5,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'normal' | 'magic' | 'bw' | 'grayscale' | 'sepia';
type CropPreset = 'full' | 'a4' | 'idcard' | 'square';

export const ScannerEditScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const pageUri = route.params?.pageUri;

  // Active Tool Panel
  const [activeTab, setActiveTab] = useState<'none' | 'crop' | 'filter' | 'adjust'>('none');

  // Tool 1: Rotation (0, 90, 180, 270)
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  // Tool 2: Filter Mode
  const [filterMode, setFilterMode] = useState<FilterType>('normal');

  // Tool 3: Crop Preset
  const [cropPreset, setCropPreset] = useState<CropPreset>('full');
  const [isCropActive, setIsCropActive] = useState<boolean>(false);

  // Tool 4: Adjustments (Brightness: -50 to +50, Contrast: 1 to 4)
  const [brightness, setBrightness] = useState<number>(0); // -50 to +50
  const [contrastLevel, setContrastLevel] = useState<number>(1); // 1 to 4

  // Rotation handler
  const handleRotate = () => {
    setRotationDeg((prev) => (prev + 90) % 360);
  };

  // Crop Preset handler
  const handleSelectCrop = (preset: CropPreset) => {
    setCropPreset(preset);
  };

  const handleApplyCrop = () => {
    setIsCropActive(false);
    setActiveTab('none');
  };

  const handleCancelCrop = () => {
    setCropPreset('full');
    setIsCropActive(false);
    setActiveTab('none');
  };

  // Reset Adjustments
  const handleResetAdjustments = () => {
    setBrightness(0);
    setContrastLevel(1);
  };

  // Save / Done
  const handleDone = () => {
    navigation.navigate('UploadDocument', {
      prefillName: 'Scanned_Doc_' + Date.now() + '.jpg',
      pageUri,
      rotationDeg,
      filterMode,
      brightness,
      contrastLevel,
      cropPreset,
    });
  };

  const isSideways = rotationDeg === 90 || rotationDeg === 270;

  // Dynamic Crop Padding & Margins based on preset
  const getCropStyle = () => {
    switch (cropPreset) {
      case 'a4':
        return { paddingHorizontal: 16, paddingVertical: 24, borderRadius: 12 };
      case 'idcard':
        return { paddingHorizontal: 28, paddingVertical: 48, borderRadius: 16 };
      case 'square':
        return { paddingHorizontal: 32, paddingVertical: 32, borderRadius: 12 };
      default:
        return { padding: 0 };
    }
  };

  // Dynamic Brightness Overlay opacity
  const getBrightnessOverlay = () => {
    if (brightness > 0) {
      return {
        backgroundColor: `rgba(255, 255, 255, ${Math.min(brightness / 100, 0.45)})`,
      };
    } else if (brightness < 0) {
      return {
        backgroundColor: `rgba(0, 0, 0, ${Math.min(Math.abs(brightness) / 100, 0.6)})`,
      };
    }
    return null;
  };

  // Dynamic Filter Style
  const getFilterOverlay = () => {
    switch (filterMode) {
      case 'magic':
        // High-contrast clean document look
        return {
          backgroundColor: 'rgba(235, 243, 255, 0.18)',
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.25)',
        };
      case 'bw':
        // Black and white high-contrast
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        };
      case 'grayscale':
        return {
          backgroundColor: 'rgba(128, 128, 128, 0.28)',
        };
      case 'sepia':
        return {
          backgroundColor: 'rgba(180, 130, 70, 0.28)',
        };
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 20
            ) + 6,
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Edit Document</Text>
          {rotationDeg !== 0 && (
            <View style={styles.rotationBadge}>
              <Text style={styles.rotationBadgeText}>{rotationDeg}°</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleDone} style={styles.iconBtn}>
          <Text style={[styles.iconBtnText, { color: colors.primary }]}>✓</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Viewport */}
      <View style={styles.canvasContainer}>
        <View style={[styles.cropWrapper, getCropStyle()]}>
          <View
            style={[
              styles.imageContainer,
              {
                transform: [
                  { rotate: `${rotationDeg}deg` },
                  { scale: isSideways ? 0.75 : 1.0 },
                ],
              },
            ]}
          >
            {pageUri ? (
              <Image
                source={{ uri: pageUri }}
                style={styles.capturedImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderSheet}>
                <Text style={styles.placeholderText}>📄 Document Preview</Text>
              </View>
            )}

            {/* Live Filter Tint Layer */}
            {getFilterOverlay() && (
              <View
                style={[StyleSheet.absoluteFillObject, getFilterOverlay(), styles.overlayLayer]}
                pointerEvents="none"
              />
            )}

            {/* Live Brightness Layer */}
            {getBrightnessOverlay() && (
              <View
                style={[StyleSheet.absoluteFillObject, getBrightnessOverlay()]}
                pointerEvents="none"
              />
            )}

            {/* Contrast Accent Layer */}
            {contrastLevel > 1 && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: `rgba(0, 0, 0, ${(contrastLevel - 1) * 0.08})`,
                  },
                ]}
                pointerEvents="none"
              />
            )}
          </View>

          {/* Interactive Crop Border & Grid Overlay */}
          {isCropActive && (
            <View style={styles.cropOverlay} pointerEvents="none">
              <View style={[styles.cropCorner, styles.cTopLeft]} />
              <View style={[styles.cropCorner, styles.cTopRight]} />
              <View style={[styles.cropCorner, styles.cBottomLeft]} />
              <View style={[styles.cropCorner, styles.cBottomRight]} />

              <View style={styles.gridLineH1} />
              <View style={styles.gridLineH2} />
              <View style={styles.gridLineV1} />
              <View style={styles.gridLineV2} />
            </View>
          )}
        </View>
      </View>

      {/* Dynamic Sub-Panel for Selected Tool */}
      {activeTab === 'crop' && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Crop & Align Bounds</Text>
            <TouchableOpacity onPress={handleCancelCrop}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.presetsRow}>
            {(['full', 'a4', 'idcard', 'square'] as CropPreset[]).map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetChip,
                  cropPreset === preset && styles.presetChipActive,
                ]}
                onPress={() => handleSelectCrop(preset)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    cropPreset === preset && styles.presetChipTextActive,
                  ]}
                >
                  {preset === 'full'
                    ? 'Full Page'
                    : preset === 'a4'
                    ? 'A4 Doc'
                    : preset === 'idcard'
                    ? 'ID Card'
                    : '1:1 Square'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCrop}>
            <Text style={styles.applyBtnText}>Apply Crop</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'filter' && (
        <View style={styles.subPanel}>
          <Text style={styles.subPanelTitle}>Document Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {[
              { id: 'normal', name: 'Original', icon: '📷' },
              { id: 'magic', name: 'Magic Scan', icon: '✨' },
              { id: 'bw', name: 'B&W Crisp', icon: '📄' },
              { id: 'grayscale', name: 'Grayscale', icon: '🔘' },
              { id: 'sepia', name: 'Warm Doc', icon: '📜' },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterCard,
                  filterMode === f.id && styles.filterCardActive,
                ]}
                onPress={() => setFilterMode(f.id as FilterType)}
              >
                <Text style={styles.filterIcon}>{f.icon}</Text>
                <Text
                  style={[
                    styles.filterName,
                    filterMode === f.id && styles.filterNameActive,
                  ]}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {activeTab === 'adjust' && (
        <View style={styles.subPanel}>
          <View style={styles.subPanelHeader}>
            <Text style={styles.subPanelTitle}>Lighting & Contrast</Text>
            <TouchableOpacity onPress={handleResetAdjustments}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Brightness Row */}
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>
              Brightness: <Text style={styles.adjustVal}>{brightness > 0 ? `+${brightness}` : brightness}%</Text>
            </Text>
            <View style={styles.adjustControls}>
              <TouchableOpacity
                style={styles.adjustStepBtn}
                onPress={() => setBrightness((prev) => Math.max(prev - 10, -50))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustStepBtn}
                onPress={() => setBrightness((prev) => Math.min(prev + 10, 50))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contrast Row */}
          <View style={styles.adjustRow}>
            <Text style={styles.adjustLabel}>
              Contrast:{' '}
              <Text style={styles.adjustVal}>
                {contrastLevel === 1
                  ? 'Normal'
                  : contrastLevel === 2
                  ? 'Medium'
                  : contrastLevel === 3
                  ? 'High'
                  : 'Ultra'}
              </Text>
            </Text>
            <View style={styles.adjustControls}>
              {[1, 2, 3, 4].map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.contrastChip,
                    contrastLevel === lvl && styles.contrastChipActive,
                  ]}
                  onPress={() => setContrastLevel(lvl)}
                >
                  <Text
                    style={[
                      styles.contrastChipText,
                      contrastLevel === lvl && styles.contrastChipTextActive,
                    ]}
                  >
                    L{lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Bottom Main Tools Bar */}
      <View style={styles.toolBar}>
        {/* Tool 1: Rotate */}
        <TouchableOpacity style={styles.toolItem} onPress={handleRotate} activeOpacity={0.7}>
          <View style={[styles.toolIconWrap, rotationDeg !== 0 && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>🔄</Text>
          </View>
          <Text style={styles.toolLabel}>Rotate ({rotationDeg}°)</Text>
        </TouchableOpacity>

        {/* Tool 2: Crop */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => {
            const next = activeTab === 'crop' ? 'none' : 'crop';
            setActiveTab(next);
            setIsCropActive(next === 'crop');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconWrap, activeTab === 'crop' && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>📐</Text>
          </View>
          <Text style={[styles.toolLabel, activeTab === 'crop' && styles.labelActive]}>
            Crop
          </Text>
        </TouchableOpacity>

        {/* Tool 3: Filter */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => setActiveTab(activeTab === 'filter' ? 'none' : 'filter')}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconWrap, activeTab === 'filter' && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>🎨</Text>
          </View>
          <Text style={[styles.toolLabel, activeTab === 'filter' && styles.labelActive]}>
            Filter: {filterMode === 'normal' ? 'Normal' : filterMode.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Tool 4: Adjust */}
        <TouchableOpacity
          style={styles.toolItem}
          onPress={() => setActiveTab(activeTab === 'adjust' ? 'none' : 'adjust')}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconWrap, activeTab === 'adjust' && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>⚙️</Text>
          </View>
          <Text style={[styles.toolLabel, activeTab === 'adjust' && styles.labelActive]}>
            Adjust
          </Text>
        </TouchableOpacity>
      </View>

      {/* Done Action Button */}
      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rotationBadge: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rotationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  iconBtn: {
    padding: 8,
  },
  iconBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  canvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cropWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  overlayLayer: {
    borderRadius: borderRadius.md,
  },
  placeholderSheet: {
    width: '80%',
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  cropCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.primary,
  },
  cTopLeft: {
    top: 4,
    left: 4,
    borderTopWidth: 5,
    borderLeftWidth: 5,
  },
  cTopRight: {
    top: 4,
    right: 4,
    borderTopWidth: 5,
    borderRightWidth: 5,
  },
  cBottomLeft: {
    bottom: 4,
    left: 4,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
  },
  cBottomRight: {
    bottom: 4,
    right: 4,
    borderBottomWidth: 5,
    borderRightWidth: 5,
  },
  gridLineH1: {
    position: 'absolute',
    top: '33.3%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66.6%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV1: {
    position: 'absolute',
    left: '33.3%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '66.6%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  subPanel: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    ...shadows.card,
  },
  subPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subPanelTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  cancelText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: 'bold',
  },
  resetText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  presetChipActive: {
    backgroundColor: colors.primary,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  filterCard: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: colors.primary,
  },
  filterIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  filterName: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterNameActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  adjustLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  adjustVal: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  adjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  contrastChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginLeft: 6,
  },
  contrastChipActive: {
    backgroundColor: colors.primary,
  },
  contrastChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  contrastChipTextActive: {
    color: '#FFFFFF',
  },
  toolBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  toolItem: {
    alignItems: 'center',
    width: SCREEN_WIDTH / 4 - 8,
  },
  toolIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolIconActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  toolIcon: {
    fontSize: 18,
  },
  toolLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  bottomAction: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  doneBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
  },
});

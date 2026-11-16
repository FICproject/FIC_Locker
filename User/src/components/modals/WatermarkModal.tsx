import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors, typography, borderRadius } from '../../theme';
import { PdfWatermarkOptions } from '../../services/pdfService';

interface WatermarkModalProps {
  visible: boolean;
  initialWatermark?: PdfWatermarkOptions;
  onApply: (watermark: PdfWatermarkOptions) => void;
  onCancel: () => void;
}

const PRESET_TEXTS = ['CONFIDENTIAL', 'ORIGINAL', 'FIC LOCKER', 'OFFICIAL COPY', 'DO NOT DUPLICATE'];
const COLOR_OPTIONS = [
  { label: 'Purple', hex: '#6C47FF' },
  { label: 'Red', hex: '#EF4444' },
  { label: 'Gray', hex: '#6B7280' },
  { label: 'Blue', hex: '#3B82F6' },
];

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  visible,
  initialWatermark,
  onApply,
  onCancel,
}) => {
  const [text, setText] = useState<string>(initialWatermark?.text || 'CONFIDENTIAL');
  const [opacity, setOpacity] = useState<number>(initialWatermark?.opacity || 0.25);
  const [color, setColor] = useState<string>(initialWatermark?.color || '#6C47FF');
  const [diagonal, setDiagonal] = useState<boolean>(initialWatermark?.diagonal !== false);
  const [tiled, setTiled] = useState<boolean>(!!initialWatermark?.tiled);

  const handleApply = () => {
    onApply({
      text: text.trim().toUpperCase(),
      opacity,
      color,
      diagonal,
      tiled,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Document Watermark</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Live Watermark Preview Box */}
            <View style={styles.previewBox}>
              <View style={styles.mockPage}>
                <View style={styles.mockContentLine} />
                <View style={[styles.mockContentLine, { width: '80%' }]} />
                <View style={[styles.mockContentLine, { width: '90%' }]} />
                <View style={[styles.mockContentLine, { width: '65%' }]} />

                {/* Live Watermark Stamp */}
                <View
                  style={[
                    styles.watermarkOverlay,
                    {
                      transform: [{ rotate: diagonal ? '-35deg' : '0deg' }],
                      opacity,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text
                    style={[
                      styles.watermarkPreviewText,
                      { color },
                      tiled && { fontSize: 13, letterSpacing: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {tiled ? `${text} • ${text}` : text}
                  </Text>
                </View>
              </View>
            </View>

            {/* Custom Watermark Text Input */}
            <Text style={styles.sectionLabel}>Watermark Text</Text>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="e.g. CONFIDENTIAL"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            {/* Quick Text Presets */}
            <View style={styles.presetsWrap}>
              {PRESET_TEXTS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.presetChip, text === t && styles.presetChipActive]}
                  onPress={() => setText(t)}
                >
                  <Text
                    style={[styles.presetChipText, text === t && styles.presetChipTextActive]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Layout Options (Diagonal / Horizontal, Tiled) */}
            <Text style={styles.sectionLabel}>Layout & Style</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, diagonal && styles.toggleBtnActive]}
                onPress={() => setDiagonal(true)}
              >
                <Text style={[styles.toggleBtnText, diagonal && styles.toggleBtnTextActive]}>
                  Diagonal (-35°)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, !diagonal && styles.toggleBtnActive]}
                onPress={() => setDiagonal(false)}
              >
                <Text style={[styles.toggleBtnText, !diagonal && styles.toggleBtnTextActive]}>
                  Horizontal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, tiled && styles.toggleBtnActive]}
                onPress={() => setTiled(!tiled)}
              >
                <Text style={[styles.toggleBtnText, tiled && styles.toggleBtnTextActive]}>
                  {tiled ? '✓ Tiled' : 'Tiled Pattern'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Color Selection */}
            <Text style={styles.sectionLabel}>Watermark Color</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c.hex}
                  style={[
                    styles.colorCard,
                    color === c.hex && { borderColor: c.hex, borderWidth: 2 },
                  ]}
                  onPress={() => setColor(c.hex)}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: c.hex }]} />
                  <Text style={styles.colorLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Opacity Selection */}
            <Text style={styles.sectionLabel}>Opacity: {Math.round(opacity * 100)}%</Text>
            <View style={styles.opacityRow}>
              {[0.15, 0.25, 0.45, 0.65].map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.opacityBtn, opacity === op && styles.opacityBtnActive]}
                  onPress={() => setOpacity(op)}
                >
                  <Text style={[styles.opacityBtnText, opacity === op && styles.opacityBtnTextActive]}>
                    {Math.round(op * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Watermark</Text>
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
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  previewBox: {
    width: '100%',
    height: 140,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mockPage: {
    width: 110,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 10,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-around',
  },
  mockContentLine: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    width: '100%',
  },
  watermarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkPreviewText: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  presetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  presetChipActive: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: 4,
  },
  colorLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  opacityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  opacityBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  opacityBtnActive: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  opacityBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  opacityBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  applyBtn: {
    flex: 1.5,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius } from '../../theme';
import { pdfService, PdfPageItem, PdfExportOptions, PdfWatermarkOptions, PdfSignatureOptions } from '../../services/pdfService';
import { SignatureModal } from './SignatureModal';
import { WatermarkModal } from './WatermarkModal';

interface PdfToolsModalProps {
  visible: boolean;
  initialPages: PdfPageItem[];
  documentTitle: string;
  onExport: (
    format: 'pdf' | 'jpg' | 'png',
    options: PdfExportOptions,
    finalPages: PdfPageItem[]
  ) => void;
  onClose: () => void;
}

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({
  visible,
  initialPages,
  documentTitle,
  onExport,
  onClose,
}) => {
  const [pages, setPages] = useState<PdfPageItem[]>(initialPages);
  const [compression, setCompression] = useState<'low' | 'medium' | 'high'>('medium');
  const [passwordProtect, setPasswordProtect] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [watermark, setWatermark] = useState<PdfWatermarkOptions | undefined>(undefined);
  const [signatures, setSignatures] = useState<PdfSignatureOptions[]>([]);

  // Sub-modals
  const [signatureModalVisible, setSignatureModalVisible] = useState<boolean>(false);
  const [watermarkModalVisible, setWatermarkModalVisible] = useState<boolean>(false);
  const [activePageIndexForSig, setActivePageIndexForSig] = useState<number>(0);

  // Sync initialPages when modal opens
  React.useEffect(() => {
    if (initialPages?.length) {
      setPages(initialPages);
    }
  }, [initialPages]);

  // Page Actions
  const handleRotatePage = (index: number) => {
    setPages((prev) => pdfService.rotatePage(prev, index));
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) {
      Alert.alert('Cannot Delete', 'A document must have at least one page.');
      return;
    }
    Alert.alert('Delete Page', `Are you sure you want to delete page ${index + 1}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setPages((prev) => pdfService.deletePage(prev, index)),
      },
    ]);
  };

  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;
    setPages((prev) => pdfService.reorderPages(prev, index, target));
  };

  const handleAddPage = async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
      const firstAsset = res.assets?.[0];
      if (firstAsset?.uri) {
        setPages((prev) => pdfService.addPage(prev, firstAsset.uri!));
      }
    } catch (e) {
      console.warn('Failed to add page from gallery:', e);
    }
  };

  const handleAddSignature = (pageIndex: number) => {
    setActivePageIndexForSig(pageIndex);
    setSignatureModalVisible(true);
  };

  const handleSignatureSaved = (sigUri: string) => {
    setSignatures((prev) => [
      ...prev.filter((s) => s.pageIndex !== activePageIndexForSig),
      {
        imageUri: sigUri,
        pageIndex: activePageIndexForSig,
        xPercent: 70,
        yPercent: 15,
        scalePercent: 35,
      },
    ]);
    setSignatureModalVisible(false);
    Alert.alert('Signature Attached', `Signature placed on page ${activePageIndexForSig + 1}.`);
  };

  const handleTriggerExport = (format: 'pdf' | 'jpg' | 'png') => {
    if (passwordProtect && (!password || password.trim().length < 4)) {
      Alert.alert('Password Required', 'Please enter at least 4 characters for PDF protection.');
      return;
    }

    const options: PdfExportOptions = {
      compression,
      password: passwordProtect ? password.trim() : undefined,
      watermark,
      signatures,
      title: documentTitle,
    };

    onExport(format, options, pages);
  };

  const profiles = pdfService.getCompressionProfiles(1024 * 1024 * 2); // ~2MB baseline

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>PDF Tools & Page Manager</Text>
              <Text style={styles.subTitle}>
                {pages.length} Page{pages.length > 1 ? 's' : ''} • Offline Tools
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 1. Page Organizer Grid / Carousel */}
            <Text style={styles.sectionTitle}>Manage Pages</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pagesScroll}>
              {pages.map((p, idx) => {
                const hasSig = signatures.some((s) => s.pageIndex === idx);
                return (
                  <View key={p.id} style={styles.pageCard}>
                    <View style={styles.pageCardThumb}>
                      <Image
                        source={{ uri: p.uri }}
                        style={[
                          styles.thumbImage,
                          { transform: [{ rotate: `${p.rotationDeg}deg` }] },
                        ]}
                        resizeMode="cover"
                      />
                      <View style={styles.pageBadge}>
                        <Text style={styles.pageBadgeText}>{idx + 1}</Text>
                      </View>
                      {hasSig && (
                        <View style={styles.sigIndicator}>
                          <Text style={styles.sigIndicatorText}>✍️ Signed</Text>
                        </View>
                      )}
                    </View>

                    {/* Page Actions Strip */}
                    <View style={styles.pageCardActions}>
                      <TouchableOpacity
                        onPress={() => handleMovePage(idx, 'left')}
                        disabled={idx === 0}
                        style={styles.pageActionBtn}
                      >
                        <Text style={[styles.actionIcon, idx === 0 && styles.disabledIcon]}>◀</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRotatePage(idx)}
                        style={styles.pageActionBtn}
                      >
                        <Text style={styles.actionIcon}>↻</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleAddSignature(idx)}
                        style={styles.pageActionBtn}
                      >
                        <Text style={styles.actionIcon}>✍️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeletePage(idx)}
                        style={styles.pageActionBtn}
                      >
                        <Text style={[styles.actionIcon, { color: colors.danger }]}>🗑️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleMovePage(idx, 'right')}
                        disabled={idx === pages.length - 1}
                        style={styles.pageActionBtn}
                      >
                        <Text
                          style={[
                            styles.actionIcon,
                            idx === pages.length - 1 && styles.disabledIcon,
                          ]}
                        >
                          ▶
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* Add Page Card */}
              <TouchableOpacity style={styles.addPageCard} onPress={handleAddPage}>
                <Text style={styles.addPageIcon}>➕</Text>
                <Text style={styles.addPageText}>Add Page</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* 2. PDF Compression Settings */}
            <Text style={styles.sectionTitle}>PDF Compression</Text>
            <View style={styles.compressionRow}>
              {(['high', 'medium', 'low'] as const).map((level) => {
                const isSelected = compression === level;
                const info = profiles[level];
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.compCard, isSelected && styles.compCardActive]}
                    onPress={() => setCompression(level)}
                  >
                    <Text style={[styles.compTitle, isSelected && styles.compTitleActive]}>
                      {level.toUpperCase()}
                    </Text>
                    <Text style={styles.compSavings}>{info.ratioText}</Text>
                    <Text style={styles.compSub}>{info.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Watermark & Signature Quick Toggles */}
            <Text style={styles.sectionTitle}>Annotations & Branding</Text>
            <View style={styles.annoRow}>
              <TouchableOpacity
                style={[styles.annoBtn, watermark && styles.annoBtnActive]}
                onPress={() => setWatermarkModalVisible(true)}
              >
                <Text style={styles.annoIcon}>💧</Text>
                <View>
                  <Text style={[styles.annoLabel, watermark && styles.annoLabelActive]}>
                    {watermark ? `Watermark: ${watermark.text}` : 'Add Watermark'}
                  </Text>
                  <Text style={styles.annoSub}>Custom text, opacity & angle</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.annoBtn, signatures.length > 0 && styles.annoBtnActive]}
                onPress={() => handleAddSignature(0)}
              >
                <Text style={styles.annoIcon}>✍️</Text>
                <View>
                  <Text style={[styles.annoLabel, signatures.length > 0 && styles.annoLabelActive]}>
                    {signatures.length > 0 ? `${signatures.length} Signature(s)` : 'Add Signature'}
                  </Text>
                  <Text style={styles.annoSub}>Draw or upload signature</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 4. Password Protection */}
            <Text style={styles.sectionTitle}>Security & Protection</Text>
            <View style={styles.securityBox}>
              <TouchableOpacity
                style={styles.securityCheckRow}
                onPress={() => setPasswordProtect(!passwordProtect)}
              >
                <View style={[styles.checkBox, passwordProtect && styles.checkBoxActive]}>
                  {passwordProtect && <Text style={styles.checkTick}>✓</Text>}
                </View>
                <Text style={styles.securityLabel}>Password-protect PDF export</Text>
              </TouchableOpacity>

              {passwordProtect && (
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Set PDF Password (min 4 characters)"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              )}
            </View>

            {/* 5. Export Formats */}
            <Text style={styles.sectionTitle}>Export Format</Text>
            <View style={styles.exportRow}>
              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: colors.pdfRed }]}
                onPress={() => handleTriggerExport('pdf')}
              >
                <Text style={styles.exportBtnIcon}>📄</Text>
                <Text style={styles.exportBtnText}>Export PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: colors.imageBlue }]}
                onPress={() => handleTriggerExport('jpg')}
              >
                <Text style={styles.exportBtnIcon}>🖼️</Text>
                <Text style={styles.exportBtnText}>Export JPG</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: '#10B981' }]}
                onPress={() => handleTriggerExport('png')}
              >
                <Text style={styles.exportBtnIcon}>✨</Text>
                <Text style={styles.exportBtnText}>Export PNG</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Signature Pad Sub-Modal */}
      <SignatureModal
        visible={signatureModalVisible}
        onSave={handleSignatureSaved}
        onCancel={() => setSignatureModalVisible(false)}
      />

      {/* Watermark Sub-Modal */}
      <WatermarkModal
        visible={watermarkModalVisible}
        initialWatermark={watermark}
        onApply={(wm) => {
          setWatermark(wm);
          setWatermarkModalVisible(false);
        }}
        onCancel={() => setWatermarkModalVisible(false)}
      />
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
    height: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 18,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  subTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 8,
  },
  pagesScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pageCard: {
    width: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 6,
    marginRight: 10,
    alignItems: 'center',
  },
  pageCardThumb: {
    width: 106,
    height: 120,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#EEF2FF',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sigIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#1E40AF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sigIndicatorText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  pageCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
  },
  pageActionBtn: {
    padding: 4,
  },
  actionIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disabledIcon: {
    color: '#D1D5DB',
  },
  addPageCard: {
    width: 100,
    height: 160,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPageIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  addPageText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  compressionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    alignItems: 'center',
  },
  compCardActive: {
    backgroundColor: '#EDE9FE',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  compTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  compTitleActive: {
    color: colors.primary,
  },
  compSavings: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    marginVertical: 2,
  },
  compSub: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  annoRow: {
    gap: 8,
  },
  annoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: 10,
    gap: 12,
  },
  annoBtnActive: {
    backgroundColor: '#EDE9FE',
    borderColor: colors.primary,
  },
  annoIcon: {
    fontSize: 20,
  },
  annoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  annoLabelActive: {
    color: colors.primary,
  },
  annoSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  securityBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  securityCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkTick: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  securityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  passwordInput: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  exportBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

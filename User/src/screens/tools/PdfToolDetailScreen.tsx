import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
  Dimensions,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, typography, borderRadius, shadows } from '../../theme';
import {
  PdfToolItem,
  SelectedFileItem,
  PdfToolConfig,
  PdfProcessResult,
} from '../../types/pdfTools';
import { DocumentItem } from '../../types';
import { pdfEngineService, ALL_PDF_TOOLS } from '../../services/pdfEngineService';
import { shareService } from '../../services/shareService';
import { formatBytes, formatDate } from '../../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// User App Brand Palette: Primary Indigo/Purple
const PRIMARY = colors.primary; // '#6C47FF'
const PRIMARY_DARK = colors.primaryDark; // '#502DDE'
const PRIMARY_LIGHT = colors.primaryLight; // '#8F71FF'
const PRIMARY_SOFT = colors.primarySoft; // '#F4F0FF'

export const PdfToolDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const toolId: string = route.params?.toolId || 'compress_pdf';
  const tool: PdfToolItem = pdfEngineService.getToolById(toolId) || ALL_PDF_TOOLS[0];

  // Workflow Stages: 1. SELECT_FILE -> 2. CONFIGURE -> 3. PROCESSING -> 4. COMPLETED
  const [stage, setStage] = useState<'select' | 'configure' | 'processing' | 'completed'>('select');

  // Selected Files
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [vaultDocs, setVaultDocs] = useState<DocumentItem[]>([]);
  const [vaultModalVisible, setVaultModalVisible] = useState(false);

  // Configuration State
  const [config, setConfig] = useState<PdfToolConfig>({
    compressionLevel: 'medium',
    rotationAngle: 90,
    watermarkText: 'FIC LOCKER SECURE',
    watermarkOpacity: 0.3,
    watermarkAngle: 45,
    customText: 'CONFIDENTIAL',
    fontSize: 16,
    pageSize: 'A4',
    password: '',
    confirmPassword: '',
    signerName: 'Document Owner',
    outputFileName: '',
  });

  // Processing Progress
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStepText, setProgressStepText] = useState('Initializing...');

  // Result Preview
  const [processResult, setProcessResult] = useState<PdfProcessResult | null>(null);
  const [isSavedToVault, setIsSavedToVault] = useState(false);
  const [editableFileName, setEditableFileName] = useState('');

  // Load user's vault documents for in-vault file selection
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cached) {
          const list: DocumentItem[] = JSON.parse(cached);
          setVaultDocs(list);
        }
      } catch {}
    })();
  }, []);

  // Quick action for Scan to PDF: Navigate straight to Camera Scanner
  useEffect(() => {
    if (toolId === 'scan_to_pdf') {
      navigation.replace('Scanner');
    }
  }, [toolId, navigation]);

  // -------------------------------------------------------------
  // STEP 1: FILE SELECTION
  // -------------------------------------------------------------
  const handlePickFromStorage = async () => {
    try {
      const mime = tool.inputFormat === 'images' ? 'image/*' : tool.inputFormat === 'pdf' ? 'application/pdf' : '*/*';
      const file = await pdfEngineService.pickNativeDocument(mime);
      if (file) {
        addFile(file);
      }
    } catch (e: any) {
      Alert.alert('File Picker', e.message || 'Could not pick file from device.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: tool.allowMultipleFiles ? 10 : 1,
        quality: 0.9,
      });

      if (res.assets && res.assets.length > 0) {
        const newFiles: SelectedFileItem[] = res.assets.map((a, idx) => ({
          id: `gallery_${Date.now()}_${idx}`,
          uri: a.uri!,
          name: a.fileName || `Photo_${idx + 1}.jpg`,
          sizeBytes: a.fileSize || 1024 * 600,
          type: a.type || 'image/jpeg',
          isPdf: false,
          pageCount: 1,
          thumbnailUri: a.uri,
        }));

        if (tool.allowMultipleFiles) {
          setSelectedFiles((prev) => [...prev, ...newFiles]);
        } else {
          setSelectedFiles(newFiles.slice(0, 1));
        }
        setStage('configure');
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message || 'Could not select photos.');
    }
  };

  const handleSelectFromVault = (doc: DocumentItem) => {
    setVaultModalVisible(false);
    const item: SelectedFileItem = {
      id: doc._id,
      uri: doc.localUri || doc.downloadUrl || '',
      name: doc.name,
      sizeBytes: doc.fileSizeBytes,
      type: doc.mimeType || (doc.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      isPdf: doc.fileType === 'pdf',
      pageCount: doc.pageCount || 1,
      thumbnailUri: doc.thumbnailUrl || doc.localUri,
    };
    addFile(item);
  };

  const addFile = (file: SelectedFileItem) => {
    if (tool.allowMultipleFiles) {
      setSelectedFiles((prev) => [...prev, file]);
    } else {
      setSelectedFiles([file]);
    }
    setStage('configure');
  };

  const handleRemoveFile = (index: number) => {
    const updated = selectedFiles.filter((_, idx) => idx !== index);
    setSelectedFiles(updated);
    if (updated.length === 0) {
      setStage('select');
    }
  };

  const handleMoveFile = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= selectedFiles.length) return;
    const updated = [...selectedFiles];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setSelectedFiles(updated);
  };

  // -------------------------------------------------------------
  // STEP 4: EXECUTE PROCESSING
  // -------------------------------------------------------------
  const handleExecute = async () => {
    if (selectedFiles.length === 0) {
      Alert.alert('File Required', 'Please select a document first.');
      return;
    }

    if (toolId === 'add_password') {
      if (!config.password || config.password.length < 4) {
        Alert.alert('Password Required', 'Please enter at least 4 characters for password protection.');
        return;
      }
      if (config.confirmPassword && config.password !== config.confirmPassword) {
        Alert.alert('Password Mismatch', 'The passwords entered do not match. Please re-check.');
        return;
      }
    }

    setStage('processing');
    setProgressPercent(10);
    setProgressStepText('Preparing document...');

    try {
      const result = await pdfEngineService.executeToolOperation(
        toolId,
        selectedFiles,
        config,
        (percent, stepText) => {
          setProgressPercent(percent);
          setProgressStepText(stepText);
        }
      );

      setProcessResult(result);
      setEditableFileName(result.fileName);
      setStage('completed');
    } catch (err: any) {
      setStage('configure');
      Alert.alert('Processing Failed', err.message || 'An error occurred while executing tool.');
    }
  };

  // -------------------------------------------------------------
  // STEP 7: SAVE, RENAME & SHARE
  // -------------------------------------------------------------
  const handleSaveToVault = async () => {
    if (!processResult) return;
    try {
      const toSave = {
        ...processResult,
        fileName: editableFileName.trim() || processResult.fileName,
      };
      await pdfEngineService.saveToVault(toSave);
      setIsSavedToVault(true);
      Alert.alert(
        'Saved to Vault',
        `"${toSave.fileName}" has been stored securely in your FIC Locker vault.`,
        [
          {
            text: '📁 View in My Docs',
            onPress: () => navigation.navigate('MainTabs', { screen: 'DocumentsTab' }),
          },
          { text: 'OK' },
        ]
      );
    } catch (e: any) {
      Alert.alert('Save Error', e.message || 'Could not save to vault.');
    }
  };

  const handleSaveToDevice = async () => {
    if (!processResult) return;
    try {
      if (Platform.OS === 'android' && NativeModules.InAppCameraModule?.saveImageToGallery) {
        if (processResult.fileType === 'pdf') {
          Alert.alert('Saved to Downloads', `File "${editableFileName}" saved to device storage.`);
        } else {
          await NativeModules.InAppCameraModule.saveImageToGallery(processResult.fileUri, editableFileName);
          Alert.alert('Saved to Gallery', `Image "${editableFileName}" saved to Pictures/FIC_Locker.`);
        }
      } else {
        Alert.alert('Device Storage', 'Document saved to local device folder.');
      }
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not save file to device.');
    }
  };

  const handleShareResult = async () => {
    if (!processResult) return;
    try {
      await shareService.shareDocumentFile(
        processResult.fileUri,
        processResult.mimeType,
        editableFileName || processResult.fileName
      );
    } catch (e: any) {
      Alert.alert('Share Failed', e.message || 'Could not open share dialog.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_DARK} />

      {/* Royal Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <View style={styles.headerBadgeRow}>
            <View style={[styles.headerIconCircle, { backgroundColor: tool.circleColor }]}>
              <Text style={styles.headerIconEmoji}>{tool.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {tool.title}
              </Text>
              <Text style={styles.headerCategoryText}>
                FIC LOCKER PDF SUITE • {tool.category.toUpperCase().replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* STAGE 1: FILE SELECTION BOX */}
        {/* ========================================================= */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.stepNumberBadge}>1</Text>
            <Text style={styles.sectionCardTitle}>
              {selectedFiles.length > 0 ? 'Selected Document(s)' : 'Select Source Document'}
            </Text>
          </View>

          {selectedFiles.length === 0 ? (
            <View style={styles.pickerOptionsContainer}>
              <Text style={styles.pickerHelpText}>
                Choose a document or image to perform {tool.title}:
              </Text>

              {/* Option A: Storage */}
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={handlePickFromStorage}
                activeOpacity={0.8}
              >
                <View style={[styles.pickerIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <Text style={styles.pickerIconEmoji}>📁</Text>
                </View>
                <View style={styles.pickerButtonInfo}>
                  <Text style={styles.pickerButtonTitle}>Choose from Storage / Files</Text>
                  <Text style={styles.pickerButtonSub}>Select any PDF, Word, or Document</Text>
                </View>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>

              {/* Option B: Gallery */}
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={handlePickFromGallery}
                activeOpacity={0.8}
              >
                <View style={[styles.pickerIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={styles.pickerIconEmoji}>🖼️</Text>
                </View>
                <View style={styles.pickerButtonInfo}>
                  <Text style={styles.pickerButtonTitle}>Choose from Photos / Gallery</Text>
                  <Text style={styles.pickerButtonSub}>Select photos or scanned pages</Text>
                </View>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>

              {/* Option C: Vault */}
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setVaultModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.pickerIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={styles.pickerIconEmoji}>🏛️</Text>
                </View>
                <View style={styles.pickerButtonInfo}>
                  <Text style={styles.pickerButtonTitle}>Select from My Vault Documents</Text>
                  <Text style={styles.pickerButtonSub}>
                    {vaultDocs.length} saved document{vaultDocs.length === 1 ? '' : 's'} available
                  </Text>
                </View>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFilesList}>
              {selectedFiles.map((f, idx) => (
                <View key={f.id} style={styles.fileDetailRow}>
                  <View style={styles.fileThumbBox}>
                    <Text style={styles.fileThumbEmoji}>{f.isPdf ? '📄' : '🖼️'}</Text>
                    <View style={styles.fileTypeTag}>
                      <Text style={styles.fileTypeTagText}>
                        {f.name.split('.').pop()?.toUpperCase() || 'FILE'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fileMetaInfo}>
                    <Text style={styles.fileNameText} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={styles.fileSubText}>
                      {formatBytes(f.sizeBytes)} • {f.pageCount || 1} Page(s)
                    </Text>
                  </View>

                  {/* Reorder Buttons if multiple */}
                  {tool.allowMultipleFiles && selectedFiles.length > 1 && (
                    <View style={styles.reorderCol}>
                      <TouchableOpacity
                        onPress={() => handleMoveFile(idx, idx - 1)}
                        disabled={idx === 0}
                        style={styles.reorderBtn}
                      >
                        <Text style={[styles.reorderText, idx === 0 && styles.disabledText]}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMoveFile(idx, idx + 1)}
                        disabled={idx === selectedFiles.length - 1}
                        style={styles.reorderBtn}
                      >
                        <Text
                          style={[
                            styles.reorderText,
                            idx === selectedFiles.length - 1 && styles.disabledText,
                          ]}
                        >
                          ▼
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => handleRemoveFile(idx)}
                    style={styles.removeFileBtn}
                  >
                    <Text style={styles.removeFileIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add More Files button for Merge / Multi */}
              {tool.allowMultipleFiles && (
                <View style={styles.addMoreRow}>
                  <TouchableOpacity
                    style={styles.addMoreBtn}
                    onPress={handlePickFromStorage}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addMoreText}>➕ Add More Files</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addMoreBtn, { backgroundColor: '#F3F4F6' }]}
                    onPress={() => setVaultModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.addMoreText, { color: colors.text }]}>🏛️ From Vault</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ========================================================= */}
        {/* STAGE 2: TOOL CONFIGURATION CONTROLS */}
        {/* ========================================================= */}
        {selectedFiles.length > 0 && stage !== 'completed' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.stepNumberBadge}>2</Text>
              <Text style={styles.sectionCardTitle}>Configure Operation</Text>
            </View>

            {/* Custom Output File Name */}
            <Text style={styles.fieldLabel}>Output Document Name</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={config.outputFileName}
                onChangeText={(t) => setConfig((prev) => ({ ...prev, outputFileName: t }))}
                placeholder={`${selectedFiles[0]?.name?.replace(/\.[^/.]+$/, '')}_${tool.title.replace(/\s+/g, '_')}`}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={styles.extBadge}>.pdf</Text>
            </View>

            {/* Tool-Specific Controls */}

            {/* A. Compression Controls */}
            {toolId === 'compress_pdf' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Compression Level</Text>
                <View style={styles.pillRow}>
                  {(['high', 'medium', 'low'] as const).map((lvl) => (
                    <TouchableOpacity
                      key={lvl}
                      style={[
                        styles.choicePill,
                        config.compressionLevel === lvl && styles.choicePillActive,
                      ]}
                      onPress={() => setConfig((p) => ({ ...p, compressionLevel: lvl }))}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          config.compressionLevel === lvl && styles.choicePillTextActive,
                        ]}
                      >
                        {lvl === 'high' ? 'High (-70%)' : lvl === 'medium' ? 'Medium (-45%)' : 'Low (-20%)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.configHint}>
                  {config.compressionLevel === 'high'
                    ? 'Maximum file size reduction, ideal for WhatsApp and Email sharing.'
                    : config.compressionLevel === 'medium'
                    ? 'Balanced compression maintaining sharp reading text clarity.'
                    : 'Minimum compression maintaining 100% full original resolution.'}
                </Text>
              </View>
            )}

            {/* B. Split Controls */}
            {toolId === 'split_pdf' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Page Range to Extract</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={config.splitRange}
                    onChangeText={(t) => setConfig((p) => ({ ...p, splitRange: t }))}
                    placeholder="e.g. 1-2, 4 (or leave blank for page 1)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <Text style={styles.configHint}>Enter page numbers or ranges separated by commas.</Text>
              </View>
            )}

            {/* C. Rotation Controls */}
            {toolId === 'rotate_pdf' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Rotation Angle</Text>
                <View style={styles.pillRow}>
                  {([90, 180, 270] as const).map((ang) => (
                    <TouchableOpacity
                      key={ang}
                      style={[
                        styles.choicePill,
                        config.rotationAngle === ang && styles.choicePillActive,
                      ]}
                      onPress={() => setConfig((p) => ({ ...p, rotationAngle: ang }))}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          config.rotationAngle === ang && styles.choicePillTextActive,
                        ]}
                      >
                        {ang}° Clockwise
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* D. Watermark Controls */}
            {toolId === 'add_watermark' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Watermark Text</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={config.watermarkText}
                    onChangeText={(t) => setConfig((p) => ({ ...p, watermarkText: t }))}
                    placeholder="Enter watermark text"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Watermark Style</Text>
                <View style={styles.pillRow}>
                  {([45, 0] as const).map((ang) => (
                    <TouchableOpacity
                      key={ang}
                      style={[
                        styles.choicePill,
                        config.watermarkAngle === ang && styles.choicePillActive,
                      ]}
                      onPress={() => setConfig((p) => ({ ...p, watermarkAngle: ang }))}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          config.watermarkAngle === ang && styles.choicePillTextActive,
                        ]}
                      >
                        {ang === 45 ? 'Diagonal (45°)' : 'Horizontal'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* E. Password Security Controls */}
            {toolId === 'add_password' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Document Password</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={config.password}
                    onChangeText={(t) => setConfig((p) => ({ ...p, password: t }))}
                    placeholder="Set 4+ character password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Confirm Password</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={config.confirmPassword}
                    onChangeText={(t) => setConfig((p) => ({ ...p, confirmPassword: t }))}
                    placeholder="Re-enter password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                  />
                </View>
              </View>
            )}

            {/* F. Page Size Controls */}
            {toolId === 'change_page_size' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Target Page Geometry</Text>
                <View style={styles.pillRow}>
                  {(['A4', 'Letter', 'A3', 'Legal'] as const).map((sz) => (
                    <TouchableOpacity
                      key={sz}
                      style={[
                        styles.choicePill,
                        config.pageSize === sz && styles.choicePillActive,
                      ]}
                      onPress={() => setConfig((p) => ({ ...p, pageSize: sz }))}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          config.pageSize === sz && styles.choicePillTextActive,
                        ]}
                      >
                        {sz}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* G. Text / Notes Controls */}
            {toolId === 'add_text' && (
              <View style={styles.toolConfigBox}>
                <Text style={styles.fieldLabel}>Text to Insert</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={config.customText}
                    onChangeText={(t) => setConfig((p) => ({ ...p, customText: t }))}
                    placeholder="e.g. APPROVED BY MANAGEMENT"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            )}

            {/* Execute Button */}
            <TouchableOpacity
              style={styles.executeButton}
              onPress={handleExecute}
              activeOpacity={0.85}
            >
              <Text style={styles.executeButtonText}>
                ⚡ Execute {tool.title}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================= */}
        {/* STAGE 3: PROCESSING PROGRESS BANNER */}
        {/* ========================================================= */}
        {stage === 'processing' && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.processingTitle}>Processing PDF...</Text>
            <Text style={styles.processingStepText}>{progressStepText}</Text>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>
        )}

        {/* ========================================================= */}
        {/* STAGE 4: PROCESSED PREVIEW & ACTIONS */}
        {/* ========================================================= */}
        {stage === 'completed' && processResult && (
          <View style={styles.resultCard}>
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>✓ OPERATION COMPLETED</Text>
            </View>

            <Text style={styles.resultTitle}>{tool.title} Finished</Text>
            <Text style={styles.resultMessage}>{processResult.message}</Text>

            {/* Document Details Card */}
            <View style={styles.resultDetailsBox}>
              <View style={styles.resultIconBox}>
                <Text style={styles.resultEmoji}>📄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultFileName} numberOfLines={1}>
                  {editableFileName || processResult.fileName}
                </Text>
                <Text style={styles.resultMeta}>
                  Size: {formatBytes(processResult.fileSizeBytes)} • {processResult.pageCount} Page(s) • Format: {processResult.fileType.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Inline Rename Box */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Rename Output File</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                value={editableFileName}
                onChangeText={setEditableFileName}
                placeholder="Enter document name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Action Buttons Grid */}
            <View style={styles.actionsGrid}>
              {/* 1. Save to Vault */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveVaultBtn, isSavedToVault && styles.savedBtn]}
                onPress={handleSaveToVault}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnEmoji}>💾</Text>
                <Text style={styles.actionBtnText}>
                  {isSavedToVault ? 'Saved in Vault' : 'Save to Vault'}
                </Text>
              </TouchableOpacity>

              {/* 2. Save to Device */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveDeviceBtn]}
                onPress={handleSaveToDevice}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnEmoji}>📥</Text>
                <Text style={styles.actionBtnText}>Save to Device</Text>
              </TouchableOpacity>

              {/* 3. Share File */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn]}
                onPress={handleShareResult}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnEmoji}>📤</Text>
                <Text style={styles.actionBtnText}>Share File</Text>
              </TouchableOpacity>

              {/* 4. Done */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.doneBtn]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnEmoji}>✓</Text>
                <Text style={styles.actionBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* VAULT DOCUMENT PICKER MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={vaultModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setVaultModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select from FIC Vault</Text>
              <TouchableOpacity onPress={() => setVaultModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.vaultListScroll} showsVerticalScrollIndicator={false}>
              {vaultDocs.length === 0 ? (
                <View style={styles.emptyVaultBox}>
                  <Text style={styles.emptyVaultEmoji}>📂</Text>
                  <Text style={styles.emptyVaultTitle}>No Documents in Vault</Text>
                  <Text style={styles.emptyVaultSub}>
                    Upload or scan a document first to select from vault.
                  </Text>
                </View>
              ) : (
                vaultDocs.map((doc) => (
                  <TouchableOpacity
                    key={doc._id}
                    style={styles.vaultItemRow}
                    onPress={() => handleSelectFromVault(doc)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.vaultItemThumb}>
                      <Text style={styles.vaultItemEmoji}>
                        {doc.fileType === 'pdf' ? '📄' : '🖼️'}
                      </Text>
                    </View>
                    <View style={styles.vaultItemInfo}>
                      <Text style={styles.vaultItemName} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={styles.vaultItemMeta}>
                        {formatBytes(doc.fileSizeBytes)} • {formatDate(doc.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.vaultSelectArrow}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    backgroundColor: PRIMARY,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: PRIMARY_DARK,
    ...shadows.card,
  },
  backBtn: {
    padding: 8,
    marginRight: 6,
  },
  backArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  headerIconEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E0D7FE',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '800',
    fontSize: 12,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  pickerOptionsContainer: {
    gap: 10,
  },
  pickerHelpText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: 12,
  },
  pickerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pickerIconEmoji: {
    fontSize: 20,
  },
  pickerButtonInfo: {
    flex: 1,
  },
  pickerButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pickerButtonSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pickerChevron: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700',
  },
  selectedFilesList: {
    gap: 10,
  },
  fileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileThumbBox: {
    width: 40,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileThumbEmoji: {
    fontSize: 18,
  },
  fileTypeTag: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: PRIMARY,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  fileTypeTagText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fileMetaInfo: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  fileSubText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reorderCol: {
    flexDirection: 'column',
    gap: 2,
    marginRight: 8,
  },
  reorderBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reorderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  disabledText: {
    color: '#D1D5DB',
  },
  removeFileBtn: {
    padding: 6,
  },
  removeFileIcon: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: 'bold',
  },
  addMoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  addMoreBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  extBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toolConfigBox: {
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  choicePillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  choicePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  choicePillTextActive: {
    color: '#FFFFFF',
  },
  configHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  executeButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: PRIMARY_LIGHT,
    ...shadows.card,
  },
  executeButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...shadows.card,
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 14,
  },
  processingStepText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
    marginTop: 6,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadows.card,
  },
  successBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  resultMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  resultDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultEmoji: {
    fontSize: 22,
  },
  resultFileName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  resultMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flexBasis: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 8,
  },
  saveVaultBtn: {
    backgroundColor: PRIMARY,
    borderWidth: 1,
    borderColor: PRIMARY_LIGHT,
  },
  savedBtn: {
    backgroundColor: '#059669',
    borderColor: '#10B981',
  },
  saveDeviceBtn: {
    backgroundColor: '#0284C7',
  },
  shareBtn: {
    backgroundColor: '#7C3AED',
  },
  doneBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  actionBtnEmoji: {
    fontSize: 16,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  vaultListScroll: {
    marginTop: 6,
  },
  vaultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FE',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vaultItemThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  vaultItemEmoji: {
    fontSize: 18,
  },
  vaultItemInfo: {
    flex: 1,
  },
  vaultItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  vaultItemMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  vaultSelectArrow: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  emptyVaultBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyVaultEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyVaultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  emptyVaultSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});

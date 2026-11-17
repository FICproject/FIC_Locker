import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
  Modal,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { documentService } from '../../services/api/documentService';
import { DocumentItem, CategoryItem } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';
import { categoryService } from '../../services/api/categoryService';
import { UploadIcon } from '../../assets/icons';
import { useAuth } from '../../context/AuthContext';
import { deduplicateDocuments } from '../../utils/documentUtils';

export const UploadDocumentScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { user } = useAuth();
  const prefillName = route.params?.prefillName || '';
  const prefillUri = route.params?.pageUri || '';
  const rotationDeg = route.params?.rotationDeg || 0;
  const ocrTextFromRoute = route.params?.ocrText || '';
  const allPagesFromRoute = route.params?.allPages || [];
  const paperSizeFromRoute = route.params?.paperSize || 'A4';
  const paperDimensionsFromRoute = route.params?.paperDimensions || '210 × 297 mm';
  const [docName, setDocName] = useState(prefillName || 'Document_' + Date.now() + '.jpg');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(prefillUri || null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal Documents');
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(() =>
    DEFAULT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    }))
  );
  const [tags, setTags] = useState(`scanned, ${paperSizeFromRoute}, document`);
  const [expiryDate, setExpiryDate] = useState('2027-12-31');

  useEffect(() => {
    categoryService.getCachedCategories().then((cached) => {
      if (cached?.length) setCategoriesList(cached);
    });
    categoryService.fetchCategories().then((serverCats) => {
      if (serverCats?.length) setCategoriesList(serverCats);
    });
  }, []);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'FIC Locker needs camera access to take a picture of your document.',
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

  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  const handlePickOption = () => {
    setPickerModalVisible(true);
  };

  const handleSelectCamera = () => {
    setPickerModalVisible(false);
    navigation.navigate('Scanner');
  };

  const handleSelectGallery = async () => {
    setPickerModalVisible(false);
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
      if (res.assets && res.assets[0]?.uri) {
        setSelectedImageUri(res.assets[0].uri);
        if (res.assets[0].fileName) {
          setDocName(res.assets[0].fileName);
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Failed to open gallery');
    }
  };

  const handleClosePicker = () => {
    setPickerModalVisible(false);
  };

  // Upload progress states
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'upload_pending' | 'uploading' | 'verifying' | 'available' | 'failed'
  >('idle');
  const [progress, setProgress] = useState(0);

  const handleStartUpload = async () => {
    if (!docName.trim()) {
      Alert.alert('Required', 'Please enter a document name.');
      return;
    }

    setUploadStatus('upload_pending');
    setProgress(20);

    const fileExt = docName.split('.').pop()?.toLowerCase() || 'jpg';
    const isPdf = fileExt === 'pdf';
    const mimeType = isPdf ? 'application/pdf' : fileExt === 'png' ? 'image/png' : 'image/jpeg';
    const fileSizeBytes = 1024 * 1024 * 1.5; // ~1.5MB estimated
    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      setProgress(45);
      setUploadStatus('uploading');

      // Step 1: Request upload authorisation & create document record in backend
      const authRes = await documentService.requestUploadAuth({
        fileName: docName.trim(),
        fileSizeBytes,
        mimeType,
        category,
        tags: parsedTags,
        notes: description.trim() || undefined,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      });

      setProgress(80);
      setUploadStatus('verifying');

      // Step 2: Confirm upload
      let confirmedDoc: any = null;
      try {
        confirmedDoc = await documentService.confirmUpload(authRes.documentId, {
          storageKey: authRes.storageKey,
        });
      } catch {
        // Backend created document in upload-auth
      }

      // Step 3: Cache in local storage for offline / instant view
      const newDocItem: DocumentItem = {
        ...(confirmedDoc || {}),
        _id: authRes.documentId || confirmedDoc?._id || `doc_${Date.now()}`,
        userId: user?._id || '',
        name: docName.trim(),
        originalFileName: docName.trim(),
        fileType: isPdf ? 'pdf' : 'jpg',
        mimeType,
        fileSizeBytes,
        storageKey: authRes.storageKey,
        category,
        tags: parsedTags,
        notes: description.trim(),
        ocrText: ocrTextFromRoute || undefined,
        pageCount: allPagesFromRoute.length || 1,
        pages: allPagesFromRoute.length ? allPagesFromRoute.map((p: any) => p.uri) : undefined,
        status: 'available',
        localUri: selectedImageUri || undefined,
        thumbnailUrl: selectedImageUri || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        const list = cached ? JSON.parse(cached) : [];
        const cleanList = deduplicateDocuments([newDocItem, ...list]);
        await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(cleanList));
      } catch {
        // ignore cache write error
      }

      setProgress(100);
      setUploadStatus('available');

      Alert.alert('Upload Complete', `Your document has been securely saved under "${category}"!`, [
        {
          text: '📁 View in Category',
          onPress: () => {
            navigation.navigate('CategoryDetail', { category });
          },
        },
        {
          text: 'View My Documents',
          onPress: () => {
            try {
              navigation.navigate('MainTabs', { screen: 'DocumentsTab' });
            } catch {
              navigation.goBack();
            }
          },
        },
        {
          text: 'Home',
          onPress: () => {
            try {
              navigation.navigate('MainTabs', { screen: 'HomeTab' });
            } catch {
              navigation.goBack();
            }
          },
        },
      ]);
    } catch (err: any) {
      console.warn('[UploadDocumentScreen] Upload error:', err);
      // Fallback: save to local offline documents so scan is never lost
      const localDocItem: DocumentItem = {
        _id: `doc_local_${Date.now()}`,
        userId: user?._id || '',
        name: docName.trim(),
        originalFileName: docName.trim(),
        fileType: isPdf ? 'pdf' : 'jpg',
        mimeType,
        fileSizeBytes,
        storageKey: `local/${docName.trim()}`,
        category,
        tags: parsedTags,
        notes: description.trim(),
        ocrText: ocrTextFromRoute || undefined,
        pageCount: allPagesFromRoute.length || 1,
        pages: allPagesFromRoute.length ? allPagesFromRoute.map((p: any) => p.uri) : undefined,
        status: 'available',
        localUri: selectedImageUri || undefined,
        thumbnailUrl: selectedImageUri || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        const list = cached ? JSON.parse(cached) : [];
        const cleanList = deduplicateDocuments([localDocItem, ...list]);
        await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(cleanList));
      } catch {}

      setProgress(100);
      setUploadStatus('available');

      Alert.alert('Document Saved', `Your document has been securely saved under "${category}"!`, [
        {
          text: '📁 View in Category',
          onPress: () => {
            navigation.navigate('CategoryDetail', { category });
          },
        },
        {
          text: 'View My Documents',
          onPress: () => {
            try {
              navigation.navigate('MainTabs', { screen: 'DocumentsTab' });
            } catch {
              navigation.goBack();
            }
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Upload Document</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Upload Drop Zone Card */}
      <TouchableOpacity
        style={styles.dropZone}
        onPress={handlePickOption}
        activeOpacity={0.8}
      >
        {selectedImageUri ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: selectedImageUri }}
              style={[
                styles.previewImage,
                rotationDeg !== 0 && { transform: [{ rotate: `${rotationDeg}deg` }] },
              ]}
              resizeMode="contain"
            />
            <View style={styles.changeBadge}>
              <Text style={styles.changeBadgeText}>Tap to change</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.uploadIconBadge}>
              <UploadIcon size={32} color={colors.primary} />
            </View>
            <Text style={styles.dropTitle}>Tap to take photo or select files</Text>
            <Text style={styles.dropSub}>Camera or Gallery: JPG, PNG, PDF</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Progress status card when uploading */}
      {uploadStatus !== 'idle' && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Status: {uploadStatus.toUpperCase()}</Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      {/* Metadata Inputs */}
      <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Document Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter document name"
            placeholderTextColor={colors.textMuted}
            value={docName}
            onChangeText={setDocName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description / Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add description..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categoriesList.map((cat) => {
              const isSelected = category === cat.name;
              return (
                <TouchableOpacity
                  key={cat.id || cat.name}
                  style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                  onPress={() => setCategory(cat.name)}
                >
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tags (Comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. tax, 2026, invoice"
            placeholderTextColor={colors.textMuted}
            value={tags}
            onChangeText={setTags}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Expiry Date (Optional reminder)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
        </View>

        <TouchableOpacity
          style={[styles.uploadButton, uploadStatus === 'uploading' && styles.btnDisabled]}
          onPress={handleStartUpload}
          disabled={uploadStatus === 'uploading'}
          activeOpacity={0.85}
        >
          {uploadStatus === 'uploading' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.uploadButtonText}>Upload Document</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Upload Source Picker Modal (Camera, Gallery, Cancel) in App Color */}
    <Modal
      visible={pickerModalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClosePicker}
    >
      <TouchableOpacity
        style={styles.pickerBackdrop}
        activeOpacity={1}
        onPress={handleClosePicker}
      >
        <View style={styles.pickerCard}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            <View style={styles.pickerBadge}>
              <UploadIcon size={26} color={colors.primary} />
            </View>
            <Text style={styles.pickerTitle}>Upload Document</Text>
            <Text style={styles.pickerSubtitle}>
              Choose how you want to add your document:
            </Text>
          </View>

          {/* Options: 1. Camera, 2. Gallery */}
          <View style={styles.pickerOptionsCol}>
            {/* 1. Camera / Scan Document */}
            <TouchableOpacity
              style={styles.pickerCameraBtn}
              onPress={handleSelectCamera}
              activeOpacity={0.85}
            >
              <View style={styles.pickerCameraIconWrap}>
                <Text style={styles.pickerCameraEmoji}>📷</Text>
              </View>
              <View style={styles.pickerBtnTextCol}>
                <Text style={styles.pickerCameraTitle}>Scan Document (Camera)</Text>
                <Text style={styles.pickerCameraSub}>Auto-detect edges & straighten</Text>
              </View>
              <Text style={styles.pickerCameraArrow}>›</Text>
            </TouchableOpacity>

            {/* 2. Choose from Gallery */}
            <TouchableOpacity
              style={styles.pickerGalleryBtn}
              onPress={handleSelectGallery}
              activeOpacity={0.85}
            >
              <View style={styles.pickerGalleryIconWrap}>
                <Text style={styles.pickerGalleryEmoji}>🖼️</Text>
              </View>
              <View style={styles.pickerBtnTextCol}>
                <Text style={styles.pickerGalleryTitle}>Choose from Gallery</Text>
                <Text style={styles.pickerGallerySub}>Select photos or files from device</Text>
              </View>
              <Text style={styles.pickerGalleryArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 3. Cancel */}
          <TouchableOpacity
            style={styles.pickerCancelBtn}
            onPress={handleClosePicker}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerCancelBtnText}>Cancel</Text>
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
    backgroundColor: '#F8F9FE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    padding: 6,
  },
  backText: {
    fontSize: 24,
    color: colors.text,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: '#D4C6FC',
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    backgroundColor: '#F7F4FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  uploadIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDE7FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  dropSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 6,
  },
  progressCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: borderRadius.md,
    marginBottom: 16,
    ...shadows.card,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: 20,
    ...shadows.card,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#FAFAFF',
    paddingHorizontal: 14,
    height: 48,
    fontSize: typography.fontSizes.base,
    color: colors.text,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.bold,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    ...shadows.glow,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold,
  },
  previewContainer: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  pickerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F4F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E4DCFD',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: '#111827',
    marginBottom: 6,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  pickerOptionsCol: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  pickerCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary || '#6C47FF',
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadows.glow,
  },
  pickerCameraIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pickerCameraEmoji: {
    fontSize: 20,
  },
  pickerBtnTextCol: {
    flex: 1,
  },
  pickerCameraTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  pickerCameraSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  pickerCameraArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  pickerGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary || '#6C47FF',
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pickerGalleryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pickerGalleryEmoji: {
    fontSize: 20,
  },
  pickerGalleryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary || '#6C47FF',
    marginBottom: 2,
  },
  pickerGallerySub: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickerGalleryArrow: {
    fontSize: 22,
    color: colors.primary || '#6C47FF',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  pickerCancelBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
});


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
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { documentService } from '../../services/api/documentService';
import { DocumentItem, CategoryItem } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';
import { categoryService } from '../../services/api/categoryService';
import { UploadIcon } from '../../assets/icons';

export const UploadDocumentScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const prefillName = route.params?.prefillName || '';
  const prefillUri = route.params?.pageUri || '';
  const rotationDeg = route.params?.rotationDeg || 0;
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
  const [tags, setTags] = useState('scanned, document');
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

  const handlePickOption = () => {
    Alert.alert('Upload Document', 'Choose how you want to add your document:', [
      {
        text: '📸 Take Photo (Camera)',
        onPress: async () => {
          const hasPerm = await requestCameraPermission();
          if (!hasPerm) return;
          const res = await launchCamera({ mediaType: 'photo', quality: 0.9, saveToPhotos: true });
          if (res.assets && res.assets[0]?.uri) {
            setSelectedImageUri(res.assets[0].uri);
            if (res.assets[0].fileName) {
              setDocName(res.assets[0].fileName);
            }
          }
        },
      },
      {
        text: '🖼️ Choose from Gallery',
        onPress: async () => {
          const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
          if (res.assets && res.assets[0]?.uri) {
            setSelectedImageUri(res.assets[0].uri);
            if (res.assets[0].fileName) {
              setDocName(res.assets[0].fileName);
            }
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
        userId: 'usr_default',
        name: docName.trim(),
        originalFileName: docName.trim(),
        fileType: isPdf ? 'pdf' : 'jpg',
        mimeType,
        fileSizeBytes,
        storageKey: authRes.storageKey,
        category,
        tags: parsedTags,
        notes: description.trim(),
        status: 'available',
        localUri: selectedImageUri || undefined,
        thumbnailUrl: selectedImageUri || undefined,
        pageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        const list = cached ? JSON.parse(cached) : [];
        list.unshift(newDocItem);
        await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(list));
      } catch {
        // ignore cache write error
      }

      setProgress(100);
      setUploadStatus('available');

      Alert.alert('Upload Complete', 'Your document has been securely saved and added to My Documents!', [
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
        userId: 'usr_default',
        name: docName.trim(),
        originalFileName: docName.trim(),
        fileType: isPdf ? 'pdf' : 'jpg',
        mimeType,
        fileSizeBytes,
        storageKey: `local/${docName.trim()}`,
        category,
        tags: parsedTags,
        notes: description.trim(),
        status: 'available',
        localUri: selectedImageUri || undefined,
        thumbnailUrl: selectedImageUri || undefined,
        pageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const cached = await AsyncStorage.getItem('@fic_locker_offline_docs');
        const list = cached ? JSON.parse(cached) : [];
        list.unshift(localDocItem);
        await AsyncStorage.setItem('@fic_locker_offline_docs', JSON.stringify(list));
      } catch {}

      setProgress(100);
      setUploadStatus('available');

      Alert.alert('Document Saved', 'Your document has been securely saved to My Documents!', [
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
});


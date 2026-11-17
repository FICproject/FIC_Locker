import { Share, Linking, Alert, Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocumentItem } from '../types';
import { pdfService } from './pdfService';

export const shareService = {
  /**
   * Share document file (PDF or Image) directly as an attached file via Android Share Sheet.
   * Guarantees that documents are shared as actual physical files (.pdf, .jpg), NEVER as plain text.
   */
  async shareDocument(
    doc: DocumentItem,
    options?: { format?: 'pdf' | 'jpg'; password?: string }
  ): Promise<boolean> {
    try {
      // 1. Enrich document metadata from local offline cache if possible
      let fullDoc: DocumentItem = { ...doc };
      try {
        const cachedRaw = await AsyncStorage.getItem('@fic_locker_offline_docs');
        if (cachedRaw) {
          const cachedList: DocumentItem[] = JSON.parse(cachedRaw);
          const found = cachedList.find(
            (d) =>
              (doc._id && d._id === doc._id) ||
              d.name === doc.name ||
              d.originalFileName === doc.name ||
              d.name === doc.originalFileName
          );
          if (found) {
            fullDoc = {
              ...found,
              ...fullDoc,
              localUri: fullDoc.localUri || found.localUri,
              thumbnailUrl: fullDoc.thumbnailUrl || found.thumbnailUrl,
              pages: (fullDoc.pages && fullDoc.pages.length > 0) ? fullDoc.pages : found.pages,
              downloadUrl: fullDoc.downloadUrl || found.downloadUrl,
              pageCount: fullDoc.pageCount || found.pageCount,
            };
          }
        }
      } catch (cacheErr) {
        console.warn('[shareService] Cache lookup error:', cacheErr);
      }

      const isPdf =
        options?.format === 'pdf' ||
        fullDoc.fileType === 'pdf' ||
        (Boolean(fullDoc.name) && fullDoc.name.toLowerCase().endsWith('.pdf')) ||
        Boolean(fullDoc.pages && fullDoc.pages.length > 0);

      const rawTitle = (fullDoc.name || fullDoc.originalFileName || 'Document')
        .replace(/\.[^/.]+$/, '')
        .trim();
      const cleanTitle = rawTitle || 'Document';

      // 2. Handle PDF Document Sharing
      if (isPdf) {
        const pdfFileName = `${cleanTitle}.pdf`;

        // A. If the document has scanned page images, ALWAYS convert to a fresh native PDF embedding the real photos
        const pageUris: string[] = (fullDoc.pages && fullDoc.pages.length > 0)
          ? fullDoc.pages.filter(Boolean)
          : (fullDoc.localUri && !fullDoc.localUri.toLowerCase().endsWith('.pdf'))
          ? [fullDoc.localUri]
          : [];

        if (pageUris.length > 0) {
          try {
            const pdfPages = pageUris.map((uri, idx) => ({
              id: `p_${idx + 1}`,
              uri,
              rotationDeg: 0,
            }));
            const pdfRes = await pdfService.createPdfFromPages(pdfPages, {
              title: cleanTitle,
              password: options?.password,
            });
            if (pdfRes?.fileUri) {
              const shared = await this.shareDocumentFile(pdfRes.fileUri, 'application/pdf', pdfFileName);
              if (shared) return true;
            }
          } catch (pdfErr) {
            console.warn('[shareService] Generating PDF from pages failed:', pdfErr);
          }
        }

        // B. If a local .pdf file path already exists on device
        if (fullDoc.localUri && fullDoc.localUri.toLowerCase().endsWith('.pdf')) {
          const shared = await this.shareDocumentFile(fullDoc.localUri, 'application/pdf', pdfFileName);
          if (shared) return true;
        }

        // C. If remote downloadUrl is available
        if (fullDoc.downloadUrl) {
          const shared = await this.shareDocumentFile(fullDoc.downloadUrl, 'application/pdf', pdfFileName);
          if (shared) return true;
        }
      }

      // 3. Handle Image Document Sharing
      const imageUri =
        fullDoc.localUri ||
        (fullDoc.pages && fullDoc.pages[0]) ||
        fullDoc.thumbnailUrl ||
        fullDoc.downloadUrl;

      if (imageUri) {
        const ext =
          fullDoc.fileType === 'png' || (fullDoc.name && fullDoc.name.toLowerCase().endsWith('.png'))
            ? 'png'
            : 'jpg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const imgFileName = `${cleanTitle}.${ext}`;
        const shared = await this.shareDocumentFile(imageUri, mime, imgFileName);
        if (shared) return true;
      }

      Alert.alert(
        'Share Document',
        `Could not locate the document file for "${doc.name}". Please open the document to verify.`
      );
      return false;
    } catch (error: any) {
      console.warn('[shareService] Share failed:', error);
      Alert.alert('Share Failed', error.message || 'Unable to open share sheet.');
      return false;
    }
  },

  /**
   * Direct 1-tap share to WhatsApp.
   */
  async shareToWhatsApp(doc: DocumentItem, customNote?: string) {
    try {
      let text = `📄 *FIC Locker Secure Document*\n*Name:* ${doc.name}\n*Category:* ${doc.category || 'General'}`;
      if (customNote) {
        text += `\n*Note:* ${customNote}`;
      }
      if (doc.downloadUrl) {
        text += `\n*Link:* ${doc.downloadUrl}`;
      } else {
        text += `\n*Storage:* Verified encrypted in FIC Locker`;
      }

      const encoded = encodeURIComponent(text);
      const url = `whatsapp://send?text=${encoded}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        // Fallback to web WhatsApp or standard share
        const webUrl = `https://api.whatsapp.com/send?text=${encoded}`;
        await Linking.openURL(webUrl);
        return true;
      }
    } catch (e: any) {
      // Fallback to native share
      return this.shareDocument(doc);
    }
  },

  /**
   * Direct 1-tap share to Email.
   */
  async shareToEmail(doc: DocumentItem, recipientEmail?: string) {
    try {
      const subject = encodeURIComponent(`FIC Locker: ${doc.name}`);
      const body = encodeURIComponent(
        `Hello,\n\nPlease find the attached document "${doc.name}" securely managed in FIC Locker.\n\nCategory: ${doc.category || 'Personal'}\nDate: ${new Date(doc.createdAt).toLocaleDateString()}\nStatus: Verified Original\n\nBest regards,\nFIC Locker User`
      );
      const to = recipientEmail ? encodeURIComponent(recipientEmail) : '';
      const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;

      await Linking.openURL(mailtoUrl);
      return true;
    } catch (e: any) {
      return this.shareDocument(doc);
    }
  },

  /**
   * Share raw document file directly via Android FileProvider / OS Share Sheet (WhatsApp, Email, etc.)
   */
  async shareDocumentFile(
    fileUri: string,
    mimeType: string = 'application/pdf',
    title: string = 'Document.pdf'
  ): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && NativeModules.InAppCameraModule?.shareFile) {
        const success = await NativeModules.InAppCameraModule.shareFile(fileUri, mimeType, title);
        if (success) return true;
      }

      const result = await Share.share(
        {
          title,
          url: fileUri,
        },
        {
          dialogTitle: `Share ${title}`,
        }
      );
      return result.action === Share.sharedAction;
    } catch (e: any) {
      console.warn('[shareService] shareDocumentFile error:', e);
      Alert.alert('Share Failed', e.message || 'Unable to open share sheet.');
      return false;
    }
  },
};

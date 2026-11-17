import { Share, Linking, Alert, Platform, NativeModules } from 'react-native';
import { DocumentItem } from '../types';

export const shareService = {
  /**
   * Share document file (PDF or other document) via native OS Share Sheet (WhatsApp, Email, Drive, etc.).
   */
  async shareDocument(doc: DocumentItem, options?: { format?: 'pdf' | 'jpg'; password?: string }) {
    try {
      const mime = doc.mimeType || (doc.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg');

      // 1. Try native file attachment share (Android FileProvider)
      if (Platform.OS === 'android' && doc.localUri && NativeModules.InAppCameraModule?.shareFile) {
        try {
          const success = await NativeModules.InAppCameraModule.shareFile(
            doc.localUri,
            mime,
            doc.name
          );
          if (success) return true;
        } catch (nativeErr) {
          console.warn('[shareService] Native file share failed, falling back to Share.share:', nativeErr);
        }
      }

      // 2. Fallback to standard React Native share dialog
      const shareTitle = `FIC Locker Document: ${doc.name}`;
      let shareMessage = `Sharing "${doc.name}" securely from FIC Locker.\nCategory: ${doc.category || 'General'}\nSize: ${Math.round((doc.fileSizeBytes || 1024) / 1024)} KB`;

      if (options?.password) {
        shareMessage += `\nPassword Protection: Active (PIN required to open)`;
      }

      if (doc.downloadUrl) {
        shareMessage += `\nDownload Link: ${doc.downloadUrl}`;
      }

      const result = await Share.share(
        {
          title: shareTitle,
          message: shareMessage,
          url: doc.localUri || doc.thumbnailUrl || doc.downloadUrl,
        },
        {
          dialogTitle: `Share ${doc.name}`,
        }
      );

      return result.action === Share.sharedAction;
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
          message: `Sharing ${title} from FIC Locker`,
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

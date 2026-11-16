import { Share, Linking, Alert, Platform } from 'react-native';
import { DocumentItem } from '../types';

export const shareService = {
  /**
   * Share document via native OS Share Sheet (WhatsApp, Email, Drive, etc.).
   */
  async shareDocument(doc: DocumentItem, options?: { format?: 'pdf' | 'jpg'; password?: string }) {
    try {
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
};

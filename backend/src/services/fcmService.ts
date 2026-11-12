import admin from 'firebase-admin';
import { env } from '../config/env';

let initialized = false;

function ensureFirebase(): boolean {
  if (initialized) return true;
  if (!env.firebase.projectId || !env.firebase.clientEmail || !env.firebase.privateKey) {
    return false;
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey,
      }),
    });
  }
  initialized = true;
  return true;
}

export async function sendPushNotifications(params: {
  tokens: string[];
  title: string;
  body: string;
}): Promise<{ sentCount: number; failedCount: number; configured: boolean }> {
  const uniqueTokens = Array.from(new Set(params.tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return { sentCount: 0, failedCount: 0, configured: ensureFirebase() };
  }
  if (!ensureFirebase()) {
    return { sentCount: 0, failedCount: uniqueTokens.length, configured: false };
  }

  let sentCount = 0;
  let failedCount = 0;
  // FCM multicast accepts up to 500 tokens per call
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const chunk = uniqueTokens.slice(i, i + 500);
    const result = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: params.title,
        body: params.body,
      },
    });
    sentCount += result.successCount;
    failedCount += result.failureCount;
  }

  return { sentCount, failedCount, configured: true };
}


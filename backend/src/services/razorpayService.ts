import crypto from 'crypto';
import { env } from '../config/env';
import { HttpError } from '../utils/apiResponse';

export function verifyRazorpayWebhookSignature(rawBody: string | Buffer, signature: string | undefined): boolean {
  if (!env.razorpay.webhookSecret) {
    throw new HttpError(503, 'RAZORPAY_WEBHOOK_SECRET is not configured on the backend.');
  }
  if (!signature) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function createRazorpayRefund(params: {
  providerPaymentId: string;
  amountInr?: number;
  reason?: string;
}): Promise<{ refundId: string; status: string }> {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new HttpError(
      503,
      'Razorpay API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.'
    );
  }

  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');
  const body: Record<string, unknown> = {
    notes: {
      reason: params.reason || 'Admin initiated refund',
    },
  };
  if (typeof params.amountInr === 'number' && params.amountInr > 0) {
    body.amount = Math.round(params.amountInr * 100); // paise
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(params.providerPaymentId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const payload = (await response.json()) as { id?: string; status?: string; error?: { description?: string } };
  if (!response.ok || !payload.id) {
    throw new HttpError(
      response.status >= 400 && response.status < 500 ? response.status : 502,
      payload.error?.description || 'Failed to initiate refund with Razorpay.'
    );
  }

  return {
    refundId: payload.id,
    status: payload.status || 'processed',
  };
}


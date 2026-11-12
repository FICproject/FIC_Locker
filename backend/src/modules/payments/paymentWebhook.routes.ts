import { Router, Request } from 'express';
import { asyncHandler, HttpError, sendSuccess } from '../../utils/apiResponse';
import { verifyRazorpayWebhookSignature } from '../../services/razorpayService';
import { Payment } from '../../models/Payment';
import { Subscription } from '../../models/PlanAndSubscription';

const router = Router();

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

router.post(
  '/webhook',
  asyncHandler(async (req: RawBodyRequest, res) => {
    const signature = req.header('x-razorpay-signature');
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    const valid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!valid) {
      throw new HttpError(401, 'Invalid Razorpay webhook signature.');
    }

    const event = req.body as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            method?: string;
            status?: string;
            error_description?: string;
          };
        };
        refund?: {
          entity?: {
            id?: string;
            payment_id?: string;
          };
        };
      };
    };

    const eventId = req.header('x-razorpay-event-id') || `${event.event || 'unknown'}_${event.payload?.payment?.entity?.id || Date.now()}`;
    const paymentEntity = event.payload?.payment?.entity;

    if (paymentEntity?.id || paymentEntity?.order_id) {
      const payment = await Payment.findOne({
        $or: [
          ...(paymentEntity.id ? [{ providerPaymentId: paymentEntity.id }] : []),
          ...(paymentEntity.order_id ? [{ providerOrderId: paymentEntity.order_id }] : []),
        ],
      });

      if (payment) {
        if (payment.webhookEventIds.includes(eventId)) {
          return sendSuccess(res, { idempotentReplay: true });
        }

        payment.webhookEventIds.push(eventId);
        payment.webhookVerified = true;
        if (paymentEntity.id) payment.providerPaymentId = paymentEntity.id;
        if (paymentEntity.method) payment.method = paymentEntity.method;

        if (event.event === 'payment.captured') {
          payment.status = 'captured';
          payment.paidAt = new Date();
          if (payment.subscriptionId) {
            await Subscription.updateOne(
              { _id: payment.subscriptionId },
              { $set: { status: 'active' } }
            );
          }
        } else if (event.event === 'payment.failed') {
          payment.status = 'failed';
          payment.failureReason = paymentEntity.error_description || 'Payment failed at provider.';
        } else if (event.event === 'refund.processed' && event.payload?.refund?.entity) {
          payment.status = 'refunded';
          payment.providerRefundId = event.payload.refund.entity.id;
          payment.refundedAt = new Date();
        }

        await payment.save();
      }
    }

    return sendSuccess(res, { received: true });
  })
);

export default router;


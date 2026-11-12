import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, parsePagination, sendSuccess, toCsv } from '../../utils/apiResponse';
import { Payment } from '../../models/Payment';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';
import { createRazorpayRefund } from '../../services/razorpayService';

const router = Router();
router.use(authenticateAdmin);

const refundSchema = z.object({
  amountInr: z.number().positive().optional(),
  reason: z.string().min(3).max(500),
});

function buildPaymentFilter(query: Record<string, unknown>) {
  const filter: Record<string, unknown> = {};
  const status = String(query.status || '').trim();
  const method = String(query.method || '').trim();
  const search = String(query.search || '').trim();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();

  if (status && status !== 'all') filter.status = status;
  if (method && method !== 'all') filter.method = method;
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }
  if (search) {
    filter.$or = [
      { providerPaymentId: { $regex: search, $options: 'i' } },
      { providerOrderId: { $regex: search, $options: 'i' } },
    ];
  }
  return filter;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const filter = buildPaymentFilter(req.query as Record<string, unknown>);

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email')
        .populate('planId', 'name')
        .lean(),
      Payment.countDocuments(filter),
    ]);

    const items = payments.map((p) => {
      const user = p.userId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
      const plan = p.planId as unknown as { name?: string } | null;
      return {
        _id: p._id.toString(),
        userId: user?._id ? String(user._id) : String(p.userId),
        userName: user?.fullName,
        userEmail: user?.email,
        subscriptionId: p.subscriptionId ? p.subscriptionId.toString() : undefined,
        planName: plan?.name,
        provider: p.provider,
        providerOrderId: p.providerOrderId,
        providerPaymentId: p.providerPaymentId,
        providerRefundId: p.providerRefundId,
        amountInr: p.amountInr,
        currency: p.currency,
        method: p.method,
        status: p.status,
        webhookVerified: p.webhookVerified,
        failureReason: p.failureReason,
        refundReason: p.refundReason,
        refundedAt: p.refundedAt,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      };
    });

    return sendSuccess(res, items, undefined, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  })
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const filter = buildPaymentFilter(req.query as Record<string, unknown>);
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .populate('userId', 'fullName email')
      .populate('planId', 'name')
      .lean();

    const rows = payments.map((p) => {
      const user = p.userId as unknown as { fullName?: string; email?: string } | null;
      const plan = p.planId as unknown as { name?: string } | null;
      return {
        TransactionID: p._id.toString(),
        ProviderPaymentID: p.providerPaymentId || '',
        ProviderOrderID: p.providerOrderId || '',
        UserName: user?.fullName || '',
        UserEmail: user?.email || '',
        Plan: plan?.name || '',
        AmountINR: p.amountInr,
        Currency: p.currency,
        Method: p.method || '',
        Status: p.status,
        WebhookVerified: p.webhookVerified,
        PaidAt: p.paidAt ? p.paidAt.toISOString() : '',
        CreatedAt: p.createdAt.toISOString(),
      };
    });

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payment-transactions-report.csv"');
    return res.status(200).send(csv);
  })
);

router.post(
  '/:paymentId/refund',
  asyncHandler(async (req, res) => {
    const body = refundSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      throw new HttpError(404, 'Payment transaction not found.');
    }
    if (payment.status !== 'captured') {
      throw new HttpError(400, `Only captured payments can be refunded (current status: ${payment.status}).`);
    }
    if (!payment.providerPaymentId) {
      throw new HttpError(400, 'Payment is missing providerPaymentId required by Razorpay.');
    }

    const refundAmount = body.amountInr ?? payment.amountInr;
    if (refundAmount > payment.amountInr) {
      throw new HttpError(400, 'Refund amount cannot exceed captured payment amount.');
    }

    const refundResult = await createRazorpayRefund({
      providerPaymentId: payment.providerPaymentId,
      amountInr: refundAmount,
      reason: body.reason,
    });

    payment.providerRefundId = refundResult.refundId;
    payment.status = refundAmount < payment.amountInr ? 'partially_refunded' : 'refunded';
    payment.refundReason = body.reason;
    payment.refundedAt = new Date();
    await payment.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'PAYMENT_REFUNDED',
      entityType: 'payment',
      entityId: payment._id.toString(),
      summary: `Initiated Razorpay refund (${refundAmount} INR) for payment ${payment.providerPaymentId}`,
      metadata: {
        refundId: refundResult.refundId,
        amountInr: refundAmount,
        reason: body.reason,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, {
      _id: payment._id.toString(),
      status: payment.status,
      providerRefundId: payment.providerRefundId,
      refundedAt: payment.refundedAt,
    });
  })
);

export default router;


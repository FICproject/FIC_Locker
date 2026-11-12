import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, parsePagination, sendSuccess } from '../../utils/apiResponse';
import { User } from '../../models/User';
import { StoredDocument } from '../../models/DocumentModel';
import { Subscription } from '../../models/PlanAndSubscription';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';

const router = Router();
router.use(authenticateAdmin);

const statusUpdateSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().max(500).optional(),
});

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().max(500).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const requestType = String(req.query.requestType || '').trim();

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (requestType === 'recovery') {
      filter.recoveryRequestStatus = 'pending';
    } else if (requestType === 'deletion') {
      filter.deletionRequestStatus = 'pending';
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('currentPlanId', 'name')
        .lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const activeSubs = await Subscription.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .lean();
    const subByUser = new Map<string, (typeof activeSubs)[0]>();
    for (const s of activeSubs) {
      const uid = s.userId.toString();
      if (!subByUser.has(uid)) subByUser.set(uid, s);
    }

    const items = users.map((u) => {
      const sub = subByUser.get(u._id.toString());
      return {
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        registrationDate: u.createdAt,
        storageUsedBytes: u.storageUsedBytes,
        totalDocuments: u.totalDocuments,
        planName: (u.currentPlanId as unknown as { name?: string } | null)?.name || 'Free',
        subscriptionStatus: sub?.status,
        recoveryRequestStatus: u.recoveryRequestStatus,
        deletionRequestStatus: u.deletionRequestStatus,
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
  '/:userId',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId).populate('currentPlanId', 'name').lean();
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    const [subscription, docStats] = await Promise.all([
      Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 }).populate('planId', 'name').lean(),
      StoredDocument.aggregate([
        { $match: { ownerId: user._id, status: { $ne: 'deleted' } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            usedBytes: { $sum: '$totalSizeBytes' },
          },
        },
      ]),
    ]);

    const realDocCount = docStats[0]?.count ?? user.totalDocuments;
    const realUsedBytes = docStats[0]?.usedBytes ?? user.storageUsedBytes;

    return sendSuccess(res, {
      _id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      registrationDate: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      storageUsedBytes: realUsedBytes,
      totalDocuments: realDocCount,
      planName: (user.currentPlanId as unknown as { name?: string } | null)?.name || 'Free',
      suspensionReason: user.suspensionReason,
      recoveryRequestStatus: user.recoveryRequestStatus,
      recoveryRequestNotes: user.recoveryRequestNotes,
      deletionRequestStatus: user.deletionRequestStatus,
      deletionRequestedAt: user.deletionRequestedAt,
      deletionReason: user.deletionReason,
      subscription: subscription
        ? {
            _id: subscription._id.toString(),
            userId: subscription.userId.toString(),
            planId: subscription.planId ? String((subscription.planId as { _id?: unknown })._id || subscription.planId) : '',
            planName: (subscription.planId as unknown as { name?: string } | null)?.name || 'Unknown',
            billingCycle: subscription.billingCycle,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            autoRenew: subscription.autoRenew,
            cancelledAt: subscription.cancelledAt,
            cancellationReason: subscription.cancellationReason,
          }
        : null,
    });
  })
);

router.get(
  '/:userId/documents',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const filter = { ownerId: req.params.userId };
    const [docs, total] = await Promise.all([
      StoredDocument.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('categoryId', 'name')
        .lean(),
      StoredDocument.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      docs.map((d) => ({
        ...d,
        _id: d._id.toString(),
        ownerId: d.ownerId.toString(),
        categoryName: (d.categoryId as unknown as { name?: string } | null)?.name,
      })),
      undefined,
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    );
  })
);

router.patch(
  '/:userId/status',
  asyncHandler(async (req, res) => {
    const body = statusUpdateSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const user = await User.findById(req.params.userId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    const previousStatus = user.status;
    user.status = body.status;
    user.suspensionReason = body.status === 'suspended' ? body.reason || 'Suspended by Platform Admin' : undefined;
    await user.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: body.status === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      entityType: 'user',
      entityId: user._id.toString(),
      summary: `Changed user ${user.email} status from ${previousStatus} to ${body.status}`,
      metadata: { previousStatus, newStatus: body.status, reason: body.reason },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { _id: user._id.toString(), status: user.status }, 'User status updated.');
  })
);

router.post(
  '/:userId/recovery',
  asyncHandler(async (req, res) => {
    const body = reviewSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const user = await User.findById(req.params.userId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    user.recoveryRequestStatus = body.decision;
    if (body.notes) {
      user.recoveryRequestNotes = body.notes;
    }
    if (body.decision === 'approved' && user.status === 'suspended') {
      user.status = 'active';
      user.suspensionReason = undefined;
    }
    await user.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: `USER_RECOVERY_${body.decision.toUpperCase()}`,
      entityType: 'user',
      entityId: user._id.toString(),
      summary: `Account recovery request ${body.decision} for ${user.email}`,
      metadata: { decision: body.decision, notes: body.notes },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { _id: user._id.toString(), recoveryRequestStatus: user.recoveryRequestStatus, status: user.status });
  })
);

router.post(
  '/:userId/deletion-review',
  asyncHandler(async (req, res) => {
    const body = reviewSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const user = await User.findById(req.params.userId);
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    user.deletionRequestStatus = body.decision;
    if (body.decision === 'approved') {
      user.status = 'deleted';
      await StoredDocument.updateMany(
        { ownerId: user._id, status: { $ne: 'deleted' } },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      );
      await Subscription.updateMany(
        { userId: user._id, status: 'active' },
        { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Account deletion approved' } }
      );
    }
    await user.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: `USER_DELETION_${body.decision.toUpperCase()}`,
      entityType: 'user',
      entityId: user._id.toString(),
      summary: `Account deletion request ${body.decision} for ${user.email}`,
      metadata: { decision: body.decision, notes: body.notes },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { _id: user._id.toString(), deletionRequestStatus: user.deletionRequestStatus, status: user.status });
  })
);

export default router;


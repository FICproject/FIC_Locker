import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, parsePagination, sendSuccess } from '../../utils/apiResponse';
import { Plan, Subscription } from '../../models/PlanAndSubscription';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';

export const plansRouter = Router();
plansRouter.use(authenticateAdmin);

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticateAdmin);

const planBodySchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/i),
  description: z.string().max(500).optional(),
  monthlyPriceInr: z.number().min(0),
  annualPriceInr: z.number().min(0),
  storageLimitBytes: z.number().min(1024),
  maxFileSizeBytes: z.number().min(1024),
  documentLimit: z.number().int().min(1).nullable().optional(),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

plansRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = await Plan.find({}).sort({ monthlyPriceInr: 1 }).lean();
    return sendSuccess(
      res,
      plans.map((p) => ({ ...p, _id: p._id.toString() }))
    );
  })
);

plansRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = planBodySchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const plan = await Plan.create({
      ...body,
      code: body.code.toLowerCase(),
      documentLimit: body.documentLimit ?? null,
    });

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'PLAN_CREATED',
      entityType: 'plan',
      entityId: plan._id.toString(),
      summary: `Created subscription plan "${plan.name}"`,
      metadata: { code: plan.code, monthlyPriceInr: plan.monthlyPriceInr, storageLimitBytes: plan.storageLimitBytes },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...plan.toObject(), _id: plan._id.toString() }, 'Plan created.', undefined, 201);
  })
);

plansRouter.patch(
  '/:planId',
  asyncHandler(async (req, res) => {
    const body = planBodySchema.partial().parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const plan = await Plan.findByIdAndUpdate(
      req.params.planId,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!plan) {
      throw new HttpError(404, 'Subscription plan not found.');
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'PLAN_UPDATED',
      entityType: 'plan',
      entityId: plan._id.toString(),
      summary: `Updated subscription plan "${plan.name}"`,
      metadata: body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...plan.toObject(), _id: plan._id.toString() }, 'Plan updated.');
  })
);

plansRouter.patch(
  '/:planId/status',
  asyncHandler(async (req, res) => {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const plan = await Plan.findByIdAndUpdate(
      req.params.planId,
      { $set: { isActive } },
      { new: true }
    );
    if (!plan) {
      throw new HttpError(404, 'Subscription plan not found.');
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: isActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
      entityType: 'plan',
      entityId: plan._id.toString(),
      summary: `${isActive ? 'Activated' : 'Deactivated'} plan "${plan.name}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...plan.toObject(), _id: plan._id.toString() });
  })
);

plansRouter.delete(
  '/:planId',
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new HttpError(404, 'Subscription plan not found.');
    }

    const activeSubCount = await Subscription.countDocuments({
      planId,
      status: { $in: ['active', 'trialing'] },
    });
    if (activeSubCount > 0) {
      throw new HttpError(
        400,
        `Cannot delete plan "${plan.name}" because it has ${activeSubCount} active subscriber(s). Please deactivate the plan instead.`
      );
    }

    await Plan.findByIdAndDelete(planId);

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'PLAN_DELETED',
      entityType: 'plan',
      entityId: plan._id.toString(),
      summary: `Deleted subscription plan "${plan.name}"`,
      metadata: { code: plan.code, monthlyPriceInr: plan.monthlyPriceInr },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { deleted: true, _id: planId }, `Plan "${plan.name}" deleted.`);
  })
);

subscriptionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const status = String(req.query.status || '').trim();
    const renewalFilter = String(req.query.renewal || '').trim();

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (renewalFilter === 'upcoming') {
      const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      filter.status = 'active';
      filter.autoRenew = true;
      filter.endDate = { $gte: new Date(), $lte: next30 };
    }

    const [subs, total] = await Promise.all([
      Subscription.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email')
        .populate('planId', 'name')
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    const items = subs.map((s) => {
      const user = s.userId as unknown as { _id?: unknown; fullName?: string; email?: string } | null;
      const plan = s.planId as unknown as { _id?: unknown; name?: string } | null;
      return {
        _id: s._id.toString(),
        userId: user?._id ? String(user._id) : String(s.userId),
        userName: user?.fullName,
        userEmail: user?.email,
        planId: plan?._id ? String(plan._id) : String(s.planId),
        planName: plan?.name || 'Unknown Plan',
        billingCycle: s.billingCycle,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        autoRenew: s.autoRenew,
        cancelledAt: s.cancelledAt,
        cancellationReason: s.cancellationReason,
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

export default { plansRouter, subscriptionsRouter };

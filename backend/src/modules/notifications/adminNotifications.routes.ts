import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, parsePagination, sendSuccess } from '../../utils/apiResponse';
import {
  NotificationBroadcast,
  NotificationTemplate,
  UserNotification,
} from '../../models/Notification';
import { User } from '../../models/User';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';
import { sendPushNotifications } from '../../services/fcmService';

const router = Router();
router.use(authenticateAdmin);

const broadcastSchema = z.object({
  title: z.string().min(2).max(160),
  body: z.string().min(2).max(2000),
  channel: z.enum(['in_app', 'push', 'both']).default('both'),
  targetAudience: z.enum(['all', 'selected']).default('all'),
  targetUserIds: z.array(z.string()).default([]),
  sendImmediately: z.boolean().default(true),
});

const templateSchema = z.object({
  name: z.string().min(2).max(80),
  title: z.string().min(2).max(160),
  body: z.string().min(2).max(2000),
  channel: z.enum(['in_app', 'push', 'both']).default('both'),
});

async function dispatchBroadcast(broadcast: InstanceType<typeof NotificationBroadcast>) {
  const userFilter: Record<string, unknown> = { status: 'active' };
  if (broadcast.targetAudience === 'selected') {
    if (broadcast.targetUserIds.length === 0) {
      throw new HttpError(400, 'Please select at least one user for targeted notifications.');
    }
    userFilter._id = { $in: broadcast.targetUserIds };
  }

  const recipients = await User.find(userFilter).select('_id fcmTokens').lean();

  if (broadcast.channel === 'in_app' || broadcast.channel === 'both') {
    if (recipients.length > 0) {
      await UserNotification.insertMany(
        recipients.map((u) => ({
          userId: u._id,
          broadcastId: broadcast._id,
          title: broadcast.title,
          body: broadcast.body,
          isRead: false,
        }))
      );
    }
  }

  let pushResult = { sentCount: 0, failedCount: 0, configured: false };
  if (broadcast.channel === 'push' || broadcast.channel === 'both') {
    const tokens = recipients.flatMap((u) => u.fcmTokens || []);
    pushResult = await sendPushNotifications({
      tokens,
      title: broadcast.title,
      body: broadcast.body,
    });
  }

  broadcast.recipientCount = recipients.length;
  broadcast.status = 'sent';
  broadcast.sentAt = new Date();
  await broadcast.save();

  return { recipientsCount: recipients.length, pushResult };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const [items, total] = await Promise.all([
      NotificationBroadcast.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationBroadcast.countDocuments({}),
    ]);

    return sendSuccess(
      res,
      items.map((n) => ({
        ...n,
        _id: n._id.toString(),
        targetUserIds: n.targetUserIds.map((id) => id.toString()),
      })),
      undefined,
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = broadcastSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const broadcast = await NotificationBroadcast.create({
      title: body.title,
      body: body.body,
      channel: body.channel,
      targetAudience: body.targetAudience,
      targetUserIds: body.targetAudience === 'selected' ? body.targetUserIds : [],
      status: 'draft',
    });

    let dispatchStats = null;
    if (body.sendImmediately) {
      dispatchStats = await dispatchBroadcast(broadcast);
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: body.sendImmediately ? 'NOTIFICATION_SENT' : 'NOTIFICATION_CREATED',
      entityType: 'notification',
      entityId: broadcast._id.toString(),
      summary: `${body.sendImmediately ? 'Sent' : 'Created draft'} notification "${broadcast.title}" (${broadcast.targetAudience})`,
      metadata: { channel: broadcast.channel, recipientCount: broadcast.recipientCount, dispatchStats },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(
      res,
      {
        ...broadcast.toObject(),
        _id: broadcast._id.toString(),
        targetUserIds: broadcast.targetUserIds.map((id) => id.toString()),
        dispatchStats,
      },
      body.sendImmediately ? 'Notification dispatched.' : 'Notification draft saved.',
      undefined,
      201
    );
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = broadcastSchema.partial().parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const broadcast = await NotificationBroadcast.findById(req.params.id);
    if (!broadcast) {
      throw new HttpError(404, 'Notification not found.');
    }

    if (body.title !== undefined) broadcast.title = body.title;
    if (body.body !== undefined) broadcast.body = body.body;
    if (body.channel !== undefined) broadcast.channel = body.channel;
    if (body.targetAudience !== undefined) broadcast.targetAudience = body.targetAudience;
    if (body.targetUserIds !== undefined) {
      broadcast.targetUserIds = body.targetUserIds as unknown as typeof broadcast.targetUserIds;
    }
    await broadcast.save();

    if (body.sendImmediately) {
      await dispatchBroadcast(broadcast);
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'NOTIFICATION_UPDATED',
      entityType: 'notification',
      entityId: broadcast._id.toString(),
      summary: `Updated notification "${broadcast.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, {
      ...broadcast.toObject(),
      _id: broadcast._id.toString(),
      targetUserIds: broadcast.targetUserIds.map((id) => id.toString()),
    });
  })
);

router.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const broadcast = await NotificationBroadcast.findById(req.params.id);
    if (!broadcast) {
      throw new HttpError(404, 'Notification not found.');
    }

    const dispatchStats = await dispatchBroadcast(broadcast);

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'NOTIFICATION_SENT',
      entityType: 'notification',
      entityId: broadcast._id.toString(),
      summary: `Dispatched notification "${broadcast.title}" to ${dispatchStats.recipientsCount} users`,
      metadata: dispatchStats,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, {
      ...broadcast.toObject(),
      _id: broadcast._id.toString(),
      dispatchStats,
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const broadcast = await NotificationBroadcast.findByIdAndDelete(req.params.id);
    if (!broadcast) {
      throw new HttpError(404, 'Notification not found.');
    }

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'NOTIFICATION_DELETED',
      entityType: 'notification',
      entityId: String(req.params.id),
      summary: `Deleted notification "${broadcast.title}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { deleted: true });
  })
);

router.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const templates = await NotificationTemplate.find({}).sort({ updatedAt: -1 }).lean();
    return sendSuccess(
      res,
      templates.map((t) => ({ ...t, _id: t._id.toString() }))
    );
  })
);

router.post(
  '/templates',
  asyncHandler(async (req, res) => {
    const body = templateSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const tpl = await NotificationTemplate.create(body);

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'NOTIFICATION_TEMPLATE_CREATED',
      entityType: 'notification_template',
      entityId: tpl._id.toString(),
      summary: `Created notification template "${tpl.name}"`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { ...tpl.toObject(), _id: tpl._id.toString() }, 'Template created.', undefined, 201);
  })
);

router.patch(
  '/templates/:templateId',
  asyncHandler(async (req, res) => {
    const body = templateSchema.partial().parse(req.body);
    const tpl = await NotificationTemplate.findByIdAndUpdate(
      req.params.templateId,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!tpl) throw new HttpError(404, 'Template not found.');
    return sendSuccess(res, { ...tpl.toObject(), _id: tpl._id.toString() });
  })
);

router.delete(
  '/templates/:templateId',
  asyncHandler(async (req, res) => {
    const tpl = await NotificationTemplate.findByIdAndDelete(req.params.templateId);
    if (!tpl) throw new HttpError(404, 'Template not found.');
    return sendSuccess(res, { deleted: true });
  })
);

export default router;

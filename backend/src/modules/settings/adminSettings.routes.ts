import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, sendSuccess } from '../../utils/apiResponse';
import { PlatformSettings } from '../../models/PlatformSettings';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';

const router = Router();
router.use(authenticateAdmin);

const settingsUpdateSchema = z.object({
  applicationName: z.string().min(2).max(100).optional(),
  maxUploadSizeBytes: z.number().min(1024).optional(),
  allowedFileFormats: z.array(z.string().min(3)).min(1).optional(),
  totalCloudStorageLimitBytes: z.number().min(1024 * 1024).optional(),
  defaultFreeStorageBytes: z.number().min(1024 * 1024).optional(),
  documentRetentionDays: z.number().int().min(1).max(3650).optional(),
  notificationSettings: z
    .object({
      pushEnabled: z.boolean(),
      inAppEnabled: z.boolean(),
      emailResetEnabled: z.boolean(),
    })
    .optional(),
  featureFlags: z
    .object({
      maintenanceMode: z.boolean(),
      allowNewRegistrations: z.boolean(),
      subscriptionsEnabled: z.boolean(),
      supportTicketsEnabled: z.boolean(),
    })
    .optional(),
});

async function getOrCreateSettings() {
  let settings = await PlatformSettings.findOne({ singletonKey: 'PLATFORM_SETTINGS' });
  if (!settings) {
    settings = await PlatformSettings.create({ singletonKey: 'PLATFORM_SETTINGS' });
  }
  return settings;
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getOrCreateSettings();
    return sendSuccess(res, settings.toObject());
  })
);

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const body = settingsUpdateSchema.parse(req.body);
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    const settings = await getOrCreateSettings();
    if (body.applicationName !== undefined) settings.applicationName = body.applicationName;
    if (body.maxUploadSizeBytes !== undefined) settings.maxUploadSizeBytes = body.maxUploadSizeBytes;
    if (body.allowedFileFormats !== undefined) settings.allowedFileFormats = body.allowedFileFormats;
    if (body.totalCloudStorageLimitBytes !== undefined) {
      settings.totalCloudStorageLimitBytes = body.totalCloudStorageLimitBytes;
    }
    if (body.defaultFreeStorageBytes !== undefined) settings.defaultFreeStorageBytes = body.defaultFreeStorageBytes;
    if (body.documentRetentionDays !== undefined) settings.documentRetentionDays = body.documentRetentionDays;
    if (body.notificationSettings) settings.notificationSettings = body.notificationSettings;
    if (body.featureFlags) settings.featureFlags = body.featureFlags;
    await settings.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'platform_settings',
      entityId: settings._id.toString(),
      summary: 'Updated global platform configuration settings',
      metadata: body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, settings.toObject(), 'Platform settings updated.');
  })
);

export default router;


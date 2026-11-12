import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, sendSuccess } from '../../utils/apiResponse';
import { User } from '../../models/User';
import { StoredDocument, UploadSession } from '../../models/DocumentModel';
import { Plan } from '../../models/PlanAndSubscription';
import { PlatformSettings } from '../../models/PlatformSettings';

const router = Router();
router.use(authenticateAdmin);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [settings, plans, users, docAgg, uploadExceptions, dailyUploads] = await Promise.all([
      PlatformSettings.findOne({ singletonKey: 'PLATFORM_SETTINGS' }).lean(),
      Plan.find({}).lean(),
      User.find({ status: { $ne: 'deleted' } })
        .select('fullName email storageUsedBytes totalDocuments currentPlanId')
        .sort({ storageUsedBytes: -1 })
        .limit(50)
        .lean(),
      StoredDocument.aggregate([
        { $match: { status: 'available' } },
        {
          $group: {
            _id: '$ownerId',
            usedBytes: { $sum: '$totalSizeBytes' },
            documentCount: { $sum: 1 },
          },
        },
      ]),
      UploadSession.find({ status: 'failed' })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'email')
        .lean(),
      UploadSession.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            bytes: { $sum: '$sizeBytes' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalCapacityBytes = settings?.totalCloudStorageLimitBytes ?? 1024 * 1024 * 1024 * 1024;
    const defaultQuotaBytes = settings?.defaultFreeStorageBytes ?? 500 * 1024 * 1024;

    const planMap = new Map(plans.map((p) => [p._id.toString(), p]));
    const docStatsByUser = new Map(docAgg.map((d) => [String(d._id), d]));

    let totalUsedBytes = 0;
    for (const d of docAgg) {
      totalUsedBytes += d.usedBytes || 0;
    }

    const userWiseUsage = users.map((u) => {
      const plan = u.currentPlanId ? planMap.get(u.currentPlanId.toString()) : undefined;
      const stats = docStatsByUser.get(u._id.toString());
      return {
        userId: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        planName: plan?.name || 'Free',
        usedBytes: stats?.usedBytes ?? u.storageUsedBytes ?? 0,
        quotaBytes: plan?.storageLimitBytes ?? defaultQuotaBytes,
        documentCount: stats?.documentCount ?? u.totalDocuments ?? 0,
      };
    });

    // Aggregate plan-wise storage across all non-deleted users
    const allUsersForPlan = await User.find({ status: { $ne: 'deleted' } })
      .select('_id currentPlanId storageUsedBytes')
      .lean();

    const planBucket = new Map<string, { planName: string; userCount: number; usedBytes: number; allocatedBytes: number }>();
    for (const u of allUsersForPlan) {
      const plan = u.currentPlanId ? planMap.get(u.currentPlanId.toString()) : undefined;
      const planName = plan?.name || 'Free';
      const quota = plan?.storageLimitBytes ?? defaultQuotaBytes;
      const stats = docStatsByUser.get(u._id.toString());
      const used = stats?.usedBytes ?? u.storageUsedBytes ?? 0;

      const cur = planBucket.get(planName) || { planName, userCount: 0, usedBytes: 0, allocatedBytes: 0 };
      cur.userCount += 1;
      cur.usedBytes += used;
      cur.allocatedBytes += quota;
      planBucket.set(planName, cur);
    }

    let running = Math.max(
      0,
      totalUsedBytes - dailyUploads.reduce((sum, item) => sum + (item.bytes || 0), 0)
    );
    const storageGrowth = dailyUploads.map((item) => {
      running += item.bytes || 0;
      return { date: item._id, label: item._id, value: running };
    });

    const totalAvailableBytes = Math.max(0, totalCapacityBytes - totalUsedBytes);
    const utilizationPercent = totalCapacityBytes > 0 ? Number(((totalUsedBytes / totalCapacityBytes) * 100).toFixed(2)) : 0;

    return sendSuccess(res, {
      totalCapacityBytes,
      totalUsedBytes,
      totalAvailableBytes,
      utilizationPercent,
      userWiseUsage,
      planWiseUsage: Array.from(planBucket.values()),
      storageGrowth,
      uploadExceptions: uploadExceptions.map((e) => ({
        _id: e._id.toString(),
        userId: (e.userId as unknown as { _id?: unknown } | null)?._id
          ? String((e.userId as unknown as { _id: unknown })._id)
          : String(e.userId),
        userEmail: (e.userId as unknown as { email?: string } | null)?.email,
        fileName: e.fileName,
        mimeType: e.mimeType,
        sizeBytes: e.sizeBytes,
        failureCategory: e.failureCategory || 'upload_failure',
        failureMessage: e.failureMessage || 'Upload or verification failed.',
        createdAt: e.createdAt,
      })),
    });
  })
);

export default router;


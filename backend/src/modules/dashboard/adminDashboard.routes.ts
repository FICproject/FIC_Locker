import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, sendSuccess } from '../../utils/apiResponse';
import { User } from '../../models/User';
import { StoredDocument, UploadSession } from '../../models/DocumentModel';
import { Subscription, Plan } from '../../models/PlanAndSubscription';
import { Payment } from '../../models/Payment';
import { AuditLog } from '../../models/AuditLog';
import { PlatformSettings } from '../../models/PlatformSettings';
import { SupportTicket } from '../../models/SupportTicket';

const router = Router();
router.use(authenticateAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalDocuments,
      storageAgg,
      totalUploads,
      successfulUploads,
      failedUploads,
      activeSubscriptions,
      revenueAgg,
      settings,
      recentUsers,
      recentActivities,
      openTicketsCount,
      pendingDeletionsCount,
      pendingRecoveriesCount,
      userGrowthAgg,
      uploadSeriesAgg,
      revenueSeriesAgg,
      subBreakdownAgg,
    ] = await Promise.all([
      User.countDocuments({ status: { $ne: 'deleted' } }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      StoredDocument.countDocuments({ status: { $ne: 'deleted' } }),
      StoredDocument.aggregate([
        { $match: { status: 'available' } },
        { $group: { _id: null, totalBytes: { $sum: '$totalSizeBytes' } } },
      ]),
      UploadSession.countDocuments({}),
      UploadSession.countDocuments({ status: 'completed' }),
      UploadSession.countDocuments({ status: 'failed' }),
      Subscription.countDocuments({ status: 'active' }),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amountInr' } } },
      ]),
      PlatformSettings.findOne({ singletonKey: 'PLATFORM_SETTINGS' }).lean(),
      User.find({ status: { $ne: 'deleted' } })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('currentPlanId', 'name')
        .lean(),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      User.countDocuments({ deletionRequestStatus: 'pending' }),
      User.countDocuments({ recoveryRequestStatus: 'pending' }),
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      UploadSession.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            successful: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            bytes: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$sizeBytes', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { status: 'captured', createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            amount: { $sum: '$amountInr' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Subscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$planId', count: { $sum: 1 } } },
      ]),
    ]);

    const plans = await Plan.find({}).select('_id name').lean();
    const planNameMap = new Map(plans.map((p) => [p._id.toString(), p.name]));

    const totalStorageCapacityBytes = settings?.totalCloudStorageLimitBytes ?? 1024 * 1024 * 1024 * 1024;
    const totalStorageUsedBytes = storageAgg[0]?.totalBytes ?? 0;
    const totalStorageAvailableBytes = Math.max(0, totalStorageCapacityBytes - totalStorageUsedBytes);
    const totalRevenueInr = revenueAgg[0]?.totalRevenue ?? 0;

    // Build cumulative storage trend from uploadSeriesAgg
    let runningStorageBytes = Math.max(
      0,
      totalStorageUsedBytes - uploadSeriesAgg.reduce((acc, item) => acc + (item.bytes || 0), 0)
    );
    const storageUsageTrend = uploadSeriesAgg.map((item) => {
      runningStorageBytes += item.bytes || 0;
      return {
        date: item._id,
        label: item._id,
        value: runningStorageBytes,
      };
    });

    return sendSuccess(res, {
      kpis: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalDocuments,
        totalStorageUsedBytes,
        totalStorageAvailableBytes,
        totalStorageCapacityBytes,
        totalUploads,
        successfulUploads,
        failedUploads,
        activeSubscriptions,
        totalRevenueInr,
      },
      alerts: {
        failedUploads,
        openTicketsCount,
        pendingDeletionsCount,
        pendingRecoveriesCount,
      },
      charts: {
        userRegistrationGrowth: userGrowthAgg.map((d) => ({
          date: d._id,
          label: d._id,
          value: d.count,
        })),
        documentUploadStats: uploadSeriesAgg.map((d) => ({
          date: d._id,
          successful: d.successful,
          failed: d.failed,
        })),
        storageUsageTrend,
        revenueOverview: revenueSeriesAgg.map((d) => ({
          date: d._id,
          label: d._id,
          value: d.amount,
        })),
        subscriptionStats: subBreakdownAgg.map((item) => ({
          name: planNameMap.get(String(item._id)) || 'Unknown Plan',
          value: item.count,
        })),
      },
      recentRegistrations: recentUsers.map((u) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        registrationDate: u.createdAt,
        storageUsedBytes: u.storageUsedBytes,
        totalDocuments: u.totalDocuments,
        planName: (u.currentPlanId as unknown as { name?: string } | null)?.name || 'Free',
      })),
      recentActivities: recentActivities.map((a) => ({
        _id: a._id.toString(),
        actorId: a.actorId.toString(),
        actorEmail: a.actorEmail,
        sourceApp: a.sourceApp,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        summary: a.summary,
        createdAt: a.createdAt,
      })),
    });
  })
);

export default router;


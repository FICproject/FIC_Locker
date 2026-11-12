import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, sendSuccess, toCsv } from '../../utils/apiResponse';
import { User } from '../../models/User';
import { StoredDocument, UploadSession } from '../../models/DocumentModel';
import { Subscription, Plan } from '../../models/PlanAndSubscription';
import { Payment } from '../../models/Payment';
import { SupportTicket } from '../../models/SupportTicket';

const router = Router();
router.use(authenticateAdmin);

function dateMatch(from?: string, to?: string, field = 'createdAt') {
  if (!from && !to) return {};
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { [field]: range };
}

router.get(
  '/:reportType',
  asyncHandler(async (req, res) => {
    const reportType = req.params.reportType;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const format = String(req.query.format || 'json').toLowerCase();

    let rows: Array<Record<string, unknown>> = [];
    let summary: Record<string, unknown> = {};

    switch (reportType) {
      case 'user-registration': {
        const users = await User.find(dateMatch(from, to))
          .sort({ createdAt: -1 })
          .limit(2000)
          .populate('currentPlanId', 'name')
          .lean();
        rows = users.map((u) => ({
          UserID: u._id.toString(),
          FullName: u.fullName,
          Email: u.email,
          Phone: u.phone || '',
          Status: u.status,
          Plan: (u.currentPlanId as unknown as { name?: string } | null)?.name || 'Free',
          RegisteredAt: u.createdAt.toISOString(),
        }));
        summary = { totalRegistered: rows.length };
        break;
      }

      case 'active-users': {
        const users = await User.find({ status: 'active', ...dateMatch(from, to) })
          .sort({ lastActiveAt: -1, createdAt: -1 })
          .limit(2000)
          .lean();
        rows = users.map((u) => ({
          UserID: u._id.toString(),
          FullName: u.fullName,
          Email: u.email,
          Documents: u.totalDocuments,
          StorageUsedBytes: u.storageUsedBytes,
          LastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : '',
          RegisteredAt: u.createdAt.toISOString(),
        }));
        summary = { activeUsersCount: rows.length };
        break;
      }

      case 'document-uploads': {
        const docs = await StoredDocument.find(dateMatch(from, to))
          .sort({ createdAt: -1 })
          .limit(2000)
          .populate('ownerId', 'email')
          .populate('categoryId', 'name')
          .lean();
        rows = docs.map((d) => ({
          DocumentID: d._id.toString(),
          Name: d.name,
          OwnerEmail: (d.ownerId as unknown as { email?: string } | null)?.email || '',
          Category: (d.categoryId as unknown as { name?: string } | null)?.name || '',
          SizeBytes: d.totalSizeBytes,
          Status: d.status,
          UploadedAt: d.createdAt.toISOString(),
        }));
        summary = {
          totalDocuments: rows.length,
          totalSizeBytes: rows.reduce((s, r) => s + Number(r.SizeBytes || 0), 0),
        };
        break;
      }

      case 'storage-usage': {
        const users = await User.find({ status: { $ne: 'deleted' } })
          .sort({ storageUsedBytes: -1 })
          .limit(2000)
          .populate('currentPlanId', 'name storageLimitBytes')
          .lean();
        rows = users.map((u) => {
          const plan = u.currentPlanId as unknown as { name?: string; storageLimitBytes?: number } | null;
          return {
            UserID: u._id.toString(),
            FullName: u.fullName,
            Email: u.email,
            Plan: plan?.name || 'Free',
            StorageUsedBytes: u.storageUsedBytes,
            StorageLimitBytes: plan?.storageLimitBytes ?? 0,
            TotalDocuments: u.totalDocuments,
          };
        });
        summary = {
          totalUsers: rows.length,
          totalUsedBytes: rows.reduce((s, r) => s + Number(r.StorageUsedBytes || 0), 0),
        };
        break;
      }

      case 'subscriptions': {
        const subs = await Subscription.find(dateMatch(from, to))
          .sort({ createdAt: -1 })
          .limit(2000)
          .populate('userId', 'fullName email')
          .populate('planId', 'name')
          .lean();
        rows = subs.map((s) => ({
          SubscriptionID: s._id.toString(),
          UserName: (s.userId as unknown as { fullName?: string } | null)?.fullName || '',
          UserEmail: (s.userId as unknown as { email?: string } | null)?.email || '',
          Plan: (s.planId as unknown as { name?: string } | null)?.name || '',
          BillingCycle: s.billingCycle,
          Status: s.status,
          AutoRenew: s.autoRenew,
          StartDate: s.startDate.toISOString(),
          EndDate: s.endDate ? s.endDate.toISOString() : '',
        }));
        summary = {
          totalSubscriptions: rows.length,
          activeCount: rows.filter((r) => r.Status === 'active').length,
        };
        break;
      }

      case 'payments':
      case 'revenue': {
        const filter = {
          ...dateMatch(from, to),
          ...(reportType === 'revenue' ? { status: 'captured' } : {}),
        };
        const payments = await Payment.find(filter)
          .sort({ createdAt: -1 })
          .limit(2000)
          .populate('userId', 'email')
          .populate('planId', 'name')
          .lean();
        rows = payments.map((p) => ({
          PaymentID: p._id.toString(),
          ProviderPaymentID: p.providerPaymentId || '',
          UserEmail: (p.userId as unknown as { email?: string } | null)?.email || '',
          Plan: (p.planId as unknown as { name?: string } | null)?.name || '',
          AmountINR: p.amountInr,
          Method: p.method || '',
          Status: p.status,
          WebhookVerified: p.webhookVerified,
          CreatedAt: p.createdAt.toISOString(),
        }));
        summary = {
          transactionCount: rows.length,
          totalCapturedInr: payments
            .filter((p) => p.status === 'captured')
            .reduce((s, p) => s + p.amountInr, 0),
        };
        break;
      }

      case 'failed-uploads': {
        const failed = await UploadSession.find({ status: 'failed', ...dateMatch(from, to) })
          .sort({ createdAt: -1 })
          .limit(2000)
          .populate('userId', 'email')
          .lean();
        rows = failed.map((f) => ({
          UploadSessionID: f._id.toString(),
          UserEmail: (f.userId as unknown as { email?: string } | null)?.email || '',
          FileName: f.fileName || '',
          MimeType: f.mimeType || '',
          SizeBytes: f.sizeBytes || 0,
          FailureCategory: f.failureCategory || 'upload_error',
          FailureMessage: f.failureMessage || '',
          OccurredAt: f.createdAt.toISOString(),
        }));
        summary = { failedUploadsCount: rows.length };
        break;
      }

      case 'support': {
        const tickets = await SupportTicket.find(dateMatch(from, to))
          .sort({ createdAt: -1 })
          .limit(2000)
          .populate('userId', 'email')
          .lean();
        rows = tickets.map((t) => ({
          TicketNumber: t.ticketNumber,
          UserEmail: (t.userId as unknown as { email?: string } | null)?.email || '',
          Subject: t.subject,
          Priority: t.priority,
          Status: t.status,
          CreatedAt: t.createdAt.toISOString(),
          UpdatedAt: t.updatedAt.toISOString(),
        }));
        summary = {
          totalTickets: rows.length,
          openTickets: rows.filter((r) => r.Status === 'open' || r.Status === 'in_progress').length,
        };
        break;
      }

      default:
        throw new HttpError(400, `Unsupported report type: ${reportType}`);
    }

    if (format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.csv"`);
      return res.status(200).send(csv);
    }

    // Also include active plan names count if useful
    const planCount = reportType === 'subscriptions' ? await Plan.countDocuments({}) : undefined;

    return sendSuccess(res, {
      reportType,
      summary: { ...summary, ...(planCount !== undefined ? { totalPlans: planCount } : {}) },
      rows,
    });
  })
);

export default router;


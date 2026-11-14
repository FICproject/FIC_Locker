import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import adminAuthRoutes from './modules/auth/adminAuth.routes';
import adminDashboardRoutes from './modules/dashboard/adminDashboard.routes';
import adminUsersRoutes from './modules/users/adminUsers.routes';
import adminDocumentsRoutes from './modules/documents/adminDocuments.routes';
import { plansRouter, subscriptionsRouter } from './modules/plans/adminPlans.routes';
import adminPaymentsRoutes from './modules/payments/adminPayments.routes';
import paymentWebhookRoutes from './modules/payments/paymentWebhook.routes';
import adminStorageRoutes from './modules/storage/adminStorage.routes';
import adminCategoriesRoutes from './modules/categories/adminCategories.routes';
import adminNotificationsRoutes from './modules/notifications/adminNotifications.routes';
import adminSupportRoutes from './modules/support/adminSupport.routes';
import adminReportsRoutes from './modules/reports/adminReports.routes';
import adminAuditLogsRoutes from './modules/audit-logs/adminAuditLogs.routes';
import adminSettingsRoutes from './modules/settings/adminSettings.routes';
import adminEventsRoutes from './modules/events/adminEvents.routes';
import { Plan } from './models/PlanAndSubscription';
import { userDocumentsRouter } from './modules/documents/userDocuments.routes';
import { userSharedRouter } from './modules/userShared.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Capture raw body for Razorpay webhook HMAC verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(morgan(env.nodeEnv === 'test' ? 'tiny' : 'dev'));

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok', service: 'fic-locker-shared-backend' });
  });

  // Public / User App Subscriptions & Plans (wired for both /subscriptions/plans and /plans)
  const getPublicPlansHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const plans = await Plan.find({ isActive: { $ne: false } }).sort({ monthlyPriceInr: 1 }).lean();
      const formatted = plans.map((p) => ({
        _id: p._id.toString(),
        id: p._id.toString(),
        name: p.name,
        code: p.code,
        description: p.description,
        priceMonthly: p.monthlyPriceInr,
        priceAnnually: p.annualPriceInr,
        monthlyPriceInr: p.monthlyPriceInr,
        annualPriceInr: p.annualPriceInr,
        currency: 'INR',
        storageQuotaBytes: p.storageLimitBytes,
        storageLimitBytes: p.storageLimitBytes,
        maxFileSizeBytes: p.maxFileSizeBytes,
        documentLimit: p.documentLimit,
        features: p.features || [],
        isPopular: p.code === 'plus' || p.code === 'pro' || p.name.toLowerCase().includes('plus'),
      }));
      return res.json({ success: true, data: { plans: formatted }, plans: formatted });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to fetch plans' });
    }
  };

  app.get(`${env.apiPrefix}/subscriptions/plans`, getPublicPlansHandler);
  app.get(`${env.apiPrefix}/plans`, getPublicPlansHandler);

  app.get(`${env.apiPrefix}/subscriptions/current`, async (_req, res) => {
    return res.json({ success: true, subscription: null });
  });

  // User Document & App Routes (/api/v1/documents/*, /api/v1/categories, /api/v1/storage/info)
  app.use(`${env.apiPrefix}/documents`, userDocumentsRouter);
  app.use(env.apiPrefix, userSharedRouter);

  // Shared payment webhook endpoint (used by Razorpay)
  app.use(`${env.apiPrefix}/payments`, paymentWebhookRoutes);

  // Protected Single-Admin API Surface (/api/v1/admin/*)
  const adminRouter = express.Router();
  adminRouter.use('/auth', adminAuthRoutes);
  adminRouter.use('/dashboard', adminDashboardRoutes);
  adminRouter.use('/users', adminUsersRoutes);
  adminRouter.use('/documents', adminDocumentsRoutes);
  adminRouter.use('/plans', plansRouter);
  adminRouter.use('/subscriptions', subscriptionsRouter);
  adminRouter.use('/payments', adminPaymentsRoutes);
  adminRouter.use('/storage', adminStorageRoutes);
  adminRouter.use('/categories', adminCategoriesRoutes);
  adminRouter.use('/notifications', adminNotificationsRoutes);
  adminRouter.use('/support', adminSupportRoutes);
  adminRouter.use('/reports', adminReportsRoutes);
  adminRouter.use('/audit-logs', adminAuditLogsRoutes);
  adminRouter.use('/settings', adminSettingsRoutes);
  adminRouter.use('/events', adminEventsRoutes);

  app.use(`${env.apiPrefix}/admin`, adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found.' });
  });

  app.use(errorHandler);
  return app;
}

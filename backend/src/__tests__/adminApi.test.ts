import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { env } from '../config/env';
import { ensureBaselineSeed } from '../scripts/bootstrap';
import { User } from '../models/User';
import { StoredDocument, UploadSession } from '../models/DocumentModel';
import { Plan, Subscription } from '../models/PlanAndSubscription';
import { Payment } from '../models/Payment';
import { SupportTicket } from '../models/SupportTicket';

let mongoServer: MongoMemoryServer;
let app: ReturnType<typeof createApp>;
let adminAccessToken = '';
let adminRefreshToken = '';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await ensureBaselineSeed();
  app = createApp();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Admin Shared Backend API', () => {
  it('enforces single admin login and rejects non-existent registration route', async () => {
    const regRes = await request(app).post('/api/v1/admin/auth/register').send({
      email: 'attacker@example.com',
      password: 'Password123!',
    });
    expect(regRes.status).toBe(404);

    const badLogin = await request(app).post('/api/v1/admin/auth/login').send({
      email: env.adminEmail,
      password: 'WrongPassword!',
    });
    expect(badLogin.status).toBe(401);

    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .set('x-client-platform', 'admin-web')
      .send({
        email: env.adminEmail,
        password: env.adminPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.admin.role).toBe('platform_admin');
    adminAccessToken = loginRes.body.data.accessToken;
    adminRefreshToken = loginRes.body.data.refreshToken;
  });

  it('rejects normal user tokens and unauthenticated requests on admin endpoints', async () => {
    const unauth = await request(app).get('/api/v1/admin/dashboard');
    expect(unauth.status).toBe(401);

    const forgedUserToken = jwt.sign(
      { sub: new mongoose.Types.ObjectId().toString(), role: 'user', tokenType: 'user_access' },
      env.jwtAdminAccessSecret,
      { expiresIn: '10m' }
    );
    const forbidden = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${forgedUserToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('returns real MongoDB aggregations on dashboard and storage endpoints', async () => {
    const freePlan = await Plan.findOne({ code: 'free' });
    expect(freePlan).toBeTruthy();

    const user = await User.create({
      fullName: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+919876543210',
      status: 'active',
      currentPlanId: freePlan!._id,
      storageUsedBytes: 2048,
      totalDocuments: 1,
    });

    const doc = await StoredDocument.create({
      ownerId: user._id,
      name: 'Passport Scan',
      documentType: 'Identity Proof',
      tags: ['passport'],
      files: [{ storageKey: 'opaque/key/1.pdf', mimeType: 'application/pdf', sizeBytes: 2048, pageCount: 2 }],
      totalSizeBytes: 2048,
      status: 'available',
    });

    await UploadSession.create({
      userId: user._id,
      documentId: doc._id,
      fileName: 'passport.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      status: 'completed',
    });

    await UploadSession.create({
      userId: user._id,
      fileName: 'corrupt.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 512,
      status: 'failed',
      failureCategory: 'unsupported_format',
      failureMessage: 'Executable files are blocked.',
    });

    const sub = await Subscription.create({
      userId: user._id,
      planId: freePlan!._id,
      billingCycle: 'monthly',
      status: 'active',
    });

    await Payment.create({
      userId: user._id,
      subscriptionId: sub._id,
      planId: freePlan!._id,
      provider: 'razorpay',
      providerOrderId: 'order_test_1',
      providerPaymentId: 'pay_test_1',
      amountInr: 399,
      method: 'upi',
      status: 'captured',
      webhookVerified: true,
      paidAt: new Date(),
    });

    await SupportTicket.create({
      ticketNumber: 'TKT-1001',
      userId: user._id,
      subject: 'Need help exporting PDF',
      description: 'Export stalls on large scan',
      priority: 'high',
      status: 'open',
    });

    const dashRes = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.kpis.totalUsers).toBe(1);
    expect(dashRes.body.data.kpis.totalDocuments).toBe(1);
    expect(dashRes.body.data.kpis.totalStorageUsedBytes).toBe(2048);
    expect(dashRes.body.data.kpis.successfulUploads).toBe(1);
    expect(dashRes.body.data.kpis.failedUploads).toBe(1);
    expect(dashRes.body.data.kpis.totalRevenueInr).toBe(399);

    const storageRes = await request(app)
      .get('/api/v1/admin/storage')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(storageRes.status).toBe(200);
    expect(storageRes.body.data.totalUsedBytes).toBe(2048);
    expect(storageRes.body.data.uploadExceptions.length).toBe(1);
  });

  it('supports user management, support tickets, categories, settings, CSV reports, and audit logs', async () => {
    const usersRes = await request(app)
      .get('/api/v1/admin/users?search=Aarav')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(usersRes.status).toBe(200);
    const userId = usersRes.body.data[0]._id;

    const suspendRes = await request(app)
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .set('x-client-platform', 'admin-mobile')
      .send({ status: 'suspended', reason: 'Policy check' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status).toBe('suspended');

    const ticketsRes = await request(app)
      .get('/api/v1/admin/support/tickets?status=open')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    const ticketId = ticketsRes.body.data[0]._id;

    const replyRes = await request(app)
      .post(`/api/v1/admin/support/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ message: 'Please retry upload on latest build.', status: 'resolved' });
    expect(replyRes.status).toBe(200);
    expect(replyRes.body.data.status).toBe('resolved');

    const csvRes = await request(app)
      .get('/api/v1/admin/reports/payments?format=csv')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('pay_test_1');

    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs?sourceApp=admin-mobile')
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.some((a: { action: string }) => a.action === 'USER_SUSPENDED')).toBe(true);
  });

  it('verifies Razorpay webhook HMAC signatures and processes idempotently', async () => {
    env.razorpay.webhookSecret = 'test_webhook_secret_123';

    const user = await User.findOne({ email: 'aarav@example.com' });
    await Payment.create({
      userId: user!._id,
      provider: 'razorpay',
      providerOrderId: 'order_webhook_99',
      amountInr: 149,
      status: 'created',
      webhookVerified: false,
    });

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_99',
            order_id: 'order_webhook_99',
            method: 'card',
          },
        },
      },
    });

    const badSig = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'invalid_sig')
      .send(payload);
    expect(badSig.status).toBe(401);

    const validSig = crypto
      .createHmac('sha256', env.razorpay.webhookSecret)
      .update(payload)
      .digest('hex');

    const okRes = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', validSig)
      .set('x-razorpay-event-id', 'evt_unique_99')
      .send(payload);
    expect(okRes.status).toBe(200);

    const updated = await Payment.findOne({ providerOrderId: 'order_webhook_99' });
    expect(updated?.status).toBe('captured');
    expect(updated?.webhookVerified).toBe(true);

    // Replay same event idempotently
    const replayRes = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', validSig)
      .set('x-razorpay-event-id', 'evt_unique_99')
      .send(payload);
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data.idempotentReplay).toBe(true);
  });

  it('rotates refresh tokens and revokes sessions on logout', async () => {
    const refreshRes = await request(app)
      .post('/api/v1/admin/auth/refresh')
      .send({ refreshToken: adminRefreshToken });
    expect(refreshRes.status).toBe(200);
    const newAccess = refreshRes.body.data.accessToken;

    const logoutRes = await request(app)
      .post('/api/v1/admin/auth/logout')
      .set('Authorization', `Bearer ${newAccess}`);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${newAccess}`);
    expect(afterLogout.status).toBe(401);
  });

  it('increments admin event bus version sequence across mutations for cross-app live sync', async () => {
    const loginRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: env.adminEmail,
      password: env.adminPassword,
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.accessToken as string;

    const v1 = await request(app)
      .get('/api/v1/admin/events/version')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Platform', 'admin-mobile');
    expect(v1.status).toBe(200);
    const seqBefore = v1.body.data.seq as number;

    const createCat = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Platform', 'admin-web')
      .send({ name: 'Live Sync Test Category', description: 'Testing cross-app propagation' });
    expect(createCat.status).toBe(201);

    const v2 = await request(app)
      .get('/api/v1/admin/events/version')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client-Platform', 'admin-mobile');
    expect(v2.status).toBe(200);
    expect(v2.body.data.seq).toBeGreaterThan(seqBefore);
    expect(v2.body.data.lastEvent?.sourceApp).toBe('admin-web');
  });
});


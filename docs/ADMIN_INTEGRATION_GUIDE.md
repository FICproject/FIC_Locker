# Admin Panel Integration Guide — Shared Backend & Apps

This document explains how the **Admin Website** (`Admin`), **Admin Mobile App** (`Admin_Mobile`), and the **Shared Backend Admin Modules** (`backend`) connect to the existing User Mobile App's Node.js + Express + MongoDB + Private Object Storage (S3) infrastructure.

## 1. Shared Backend & Database Architecture

- **Single Shared Database**: All Admin operations query the exact same MongoDB collections used by the User Mobile App (`users`, `documents`, `document_categories`, `plans`, `subscriptions`, `payments`, `upload_sessions`, `notifications`, `support_tickets`), plus dedicated Admin governance collections (`admin_credentials`, `admin_sessions`, `audit_logs`, `platform_settings`, `notification_templates`, `notification_broadcasts`).
- **Single Admin Constraint**: `admin_credentials` enforces `singletonKey: 'PLATFORM_ADMIN'` with a unique index. There is **no** Admin registration endpoint. The single Admin account is provisioned via the idempotent bootstrap script:
  ```bash
  npm run seed:admin
  ```
- **User / Admin Isolation**:
  - User endpoints (implemented by the User Mobile App) remain isolated under `/api/v1/auth`, `/api/v1/users`, `/api/v1/documents`, etc.
  - Admin endpoints live strictly under `/api/v1/admin/*` and require `authenticateAdmin` middleware (verifying `JWT_ADMIN_ACCESS_SECRET`, `role === 'platform_admin'`, `tokenType === 'admin_access'`, and an active unrevoked record in `admin_sessions`).
  - Every Admin request includes `X-Client-Platform: admin-web` or `X-Client-Platform: admin-mobile`, recorded in `audit_logs`.

## 2. Merging with Existing Express Backend

If your teammate already has an Express entry point (`app.ts` / `server.ts`), mount the routers from `backend/src/modules/`:

- `/api/v1/admin/auth` -> `adminAuth.routes.ts`
- `/api/v1/admin/dashboard` -> `adminDashboard.routes.ts`
- `/api/v1/admin/users` -> `adminUsers.routes.ts`
- `/api/v1/admin/documents` -> `adminDocuments.routes.ts`
- `/api/v1/admin` (`/plans`, `/subscriptions`) -> `adminPlans.routes.ts`
- `/api/v1/admin/payments` -> `adminPayments.routes.ts`
- `/api/v1/admin/storage` -> `adminStorage.routes.ts`
- `/api/v1/admin/categories` -> `adminCategories.routes.ts`
- `/api/v1/admin/notifications` -> `adminNotifications.routes.ts`
- `/api/v1/admin/support` -> `adminSupport.routes.ts`
- `/api/v1/admin/reports` -> `adminReports.routes.ts`
- `/api/v1/admin/audit-logs` -> `adminAuditLogs.routes.ts`
- `/api/v1/admin/settings` -> `adminSettings.routes.ts`
- `/api/v1/payments/webhook` -> `paymentWebhook.routes.ts` (requires raw request body capture for HMAC-SHA256 verification)

## 3. Environment & Infrastructure Checklist

1. **MongoDB**: Set `MONGODB_URI` in `backend/.env` to the shared MongoDB / MongoDB Atlas URI.
2. **Private Object Storage (AWS S3)**: Configure `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, and `S3_PRESIGNED_TTL_SECONDS=120`.
3. **Razorpay**: Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Point Razorpay's webhook to `POST https://<api-domain>/api/v1/payments/webhook`.
4. **Firebase Cloud Messaging (FCM)**: Configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` for push notifications.
5. **Admin Reset Email (SMTP)**: Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
6. **Admin Web & Mobile URLs**:
   - Web: set `VITE_API_BASE_URL` in `Admin/.env` (defaults to `/api/v1` via Vite proxy in dev).
   - Mobile: set `API_BASE_URL` in `Admin_Mobile/src/config/apiConfig.ts` (defaults to `http://10.0.2.2:5000/api/v1` for Android Emulator and `http://localhost:5000/api/v1` for iOS Simulator).


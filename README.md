# FIC Locker — Admin Platform & Shared Backend

This monorepo houses the **Single Shared Backend**, **Admin Website**, and **Admin Mobile App** for the Document Scanner & Cloud Storage SaaS Platform.

## Folder Structure

```text
├── Admin/                       # React + TypeScript + Tailwind + Recharts Admin Console
├── Admin_Mobile/                # React Native CLI + TypeScript Admin Mobile App
├── backend/                     # Single shared Node.js + Express + MongoDB backend
│   ├── src/
│   ├── .env.example
│   └── package.json
├── packages/
│   └── shared-types/            # Shared TypeScript API contracts
├── docs/
│   └── ADMIN_INTEGRATION_GUIDE.md
├── start-all.bat
└── start-web.bat
```

## Quick Start

1. Copy `backend/.env.example` to `backend/.env` and fill in your shared `MONGODB_URI`, JWT secrets, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, AWS S3, Razorpay, SMTP, and Firebase credentials.
2. Install workspace dependencies:
   ```bash
   npm install
   ```
3. Build shared types and seed the single Platform Admin account + baseline categories/plans/settings:
   ```bash
   npm run build:types
   npm run seed:admin
   ```
4. Start the shared backend and Admin Website (`start-web.bat`) or all apps (`start-all.bat`):
   ```bash
   npm run dev:backend
   npm run dev:web
   ```
5. Run backend integration tests:
   ```bash
   npm run test:backend
   ```

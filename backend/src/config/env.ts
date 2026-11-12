import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  useLocalEmbeddedDb: process.env.USE_LOCAL_EMBEDDED_DB === 'true',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doc_scanner_saas',
  jwtAdminAccessSecret: process.env.JWT_ADMIN_ACCESS_SECRET || 'dev_only_admin_access_secret_replace_in_prod_32chars',
  jwtAdminRefreshSecret: process.env.JWT_ADMIN_REFRESH_SECRET || 'dev_only_admin_refresh_secret_replace_in_prod_32chars',
  jwtAdminAccessExpiresIn: process.env.JWT_ADMIN_ACCESS_EXPIRES_IN || '15m',
  jwtAdminRefreshExpiresIn: process.env.JWT_ADMIN_REFRESH_EXPIRES_IN || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@docscanner.local',
  adminName: process.env.ADMIN_NAME || 'Platform Administrator',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@2026!Secure',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'FIC Locker Admin <no-reply@ficlocker.local>',
  },
  adminWebUrl: process.env.ADMIN_WEB_URL || 'http://localhost:5173',
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucketName: process.env.S3_BUCKET_NAME || '',
    endpoint: process.env.S3_ENDPOINT || '',
    presignedTtlSeconds: Number(process.env.S3_PRESIGNED_TTL_SECONDS || 120),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};


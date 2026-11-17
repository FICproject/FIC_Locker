import { env } from '../config/env';
import { HttpError } from '../utils/apiResponse';

let isConfigured = false;
let cloudinaryInstance: any = null;

function getCloudinaryModule(): any {
  if (!cloudinaryInstance) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const c = require('cloudinary');
      cloudinaryInstance = c.v2 || c;
    } catch {
      throw new HttpError(
        500,
        'Cloudinary package is not installed. Please run "npm install cloudinary" or use S3 storage.'
      );
    }
  }
  return cloudinaryInstance;
}

function ensureCloudinaryConfigured(): any {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new HttpError(
      503,
      'Cloud storage (Cloudinary) is not configured in environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).'
    );
  }

  const client = getCloudinaryModule();
  if (!isConfigured) {
    client.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    isConfigured = true;
  }

  return client;
}

/**
 * Generate a secure preview or download URL for a stored document in Cloudinary
 */
export async function generatePresignedDocumentUrl(params: {
  storageKey: string;
  mode: 'preview' | 'download';
  filename?: string;
  mimeType?: string;
}): Promise<{ url: string; expiresInSeconds: number }> {
  // If the storageKey is already a full HTTPS URL (e.g. from direct Cloudinary upload), use it
  if (params.storageKey.startsWith('http://') || params.storageKey.startsWith('https://')) {
    if (params.mode === 'download') {
      const downloadUrl = params.storageKey.includes('/upload/')
        ? params.storageKey.replace('/upload/', '/upload/fl_attachment/')
        : params.storageKey;
      return { url: downloadUrl, expiresInSeconds: 3600 };
    }
    return { url: params.storageKey, expiresInSeconds: 3600 };
  }

  // If Cloudinary is not configured, fall back to the local backend sample endpoint
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    const safeName = (params.filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
    return {
      url: `http://localhost:${env.port}/api/v1/documents/sample-file/${safeName}`,
      expiresInSeconds: 3600,
    };
  }

  const client = ensureCloudinaryConfigured();
  const safeName = (params.filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  const isRaw = params.mimeType?.includes('pdf') || safeName.toLowerCase().endsWith('.pdf');
  const resourceType = isRaw ? 'raw' : 'image';

  // Extract public ID from storageKey
  const publicId = params.storageKey.replace(/^documents\//, '');
  const fullPublicId = `${env.cloudinary.folder}/${publicId}`;

  const flags = params.mode === 'download' ? ['attachment'] : [];

  const url = client.url(fullPublicId, {
    resource_type: resourceType,
    flags,
    secure: true,
    sign_url: true,
  });

  return { url, expiresInSeconds: 3600 };
}

/**
 * Upload a document buffer or base64 file directly to Cloudinary
 */
export async function uploadDocumentToCloudinary(params: {
  fileBufferOrBase64: string | Buffer;
  filename: string;
  mimeType?: string;
  folder?: string;
}): Promise<{
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
}> {
  const client = ensureCloudinaryConfigured();
  const folder = params.folder || env.cloudinary.folder;
  const isPdf = params.mimeType?.includes('pdf') || params.filename.toLowerCase().endsWith('.pdf');
  const resourceType = isPdf ? 'raw' : 'auto';

  let uploadSource: string;
  if (Buffer.isBuffer(params.fileBufferOrBase64)) {
    const base64Data = params.fileBufferOrBase64.toString('base64');
    const mime = params.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg');
    uploadSource = `data:${mime};base64,${base64Data}`;
  } else {
    uploadSource = params.fileBufferOrBase64;
  }

  const result = await client.uploader.upload(uploadSource, {
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
  });

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    bytes: result.bytes,
    format: result.format || (isPdf ? 'pdf' : 'jpg'),
  };
}


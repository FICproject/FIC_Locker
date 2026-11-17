import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { HttpError } from '../utils/apiResponse';

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!env.aws.bucketName || !env.aws.accessKeyId || !env.aws.secretAccessKey) {
    throw new HttpError(
      503,
      'Private cloud object storage (S3) is not configured in environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME).'
    );
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.aws.region,
      credentials: {
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey,
      },
      ...(env.aws.endpoint ? { endpoint: env.aws.endpoint, forcePathStyle: true } : {}),
    });
  }
  return s3Client;
}

export async function generatePresignedDocumentUrl(params: {
  storageKey: string;
  mode: 'preview' | 'download';
  filename?: string;
  mimeType?: string;
}): Promise<{ url: string; expiresInSeconds: number }> {
  // If storageKey is already a full URL, return it directly
  if (params.storageKey.startsWith('http://') || params.storageKey.startsWith('https://')) {
    if (params.mode === 'download') {
      const downloadUrl = params.storageKey.includes('/upload/')
        ? params.storageKey.replace('/upload/', '/upload/fl_attachment/')
        : params.storageKey;
      return { url: downloadUrl, expiresInSeconds: 3600 };
    }
    return { url: params.storageKey, expiresInSeconds: 3600 };
  }

  // If AWS S3 credentials are configured, use S3 Client
  if (env.aws.bucketName && env.aws.accessKeyId && env.aws.secretAccessKey) {
    const client = getS3Client();
    const ttl = Math.min(300, Math.max(30, env.aws.presignedTtlSeconds));
    const safeName = (params.filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');

    const command = new GetObjectCommand({
      Bucket: env.aws.bucketName,
      Key: params.storageKey,
      ResponseContentDisposition:
        params.mode === 'download'
          ? `attachment; filename="${safeName}"`
          : `inline; filename="${safeName}"`,
      ...(params.mimeType ? { ResponseContentType: params.mimeType } : {}),
    });

    const url = await getSignedUrl(client, command, { expiresIn: ttl });
    return { url, expiresInSeconds: ttl };
  }

  // Fallback to local dev sample-file preview/download endpoint
  const safeName = (params.filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  return {
    url: `http://localhost:${env.port}/api/v1/documents/sample-file/${safeName}`,
    expiresInSeconds: 3600,
  };
}

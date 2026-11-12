import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { HttpError } from '../utils/apiResponse';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
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


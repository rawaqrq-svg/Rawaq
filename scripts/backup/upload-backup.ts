import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BackupConfig } from './config';

export interface UploadResult {
  storageType: 's3' | 'local';
  remoteKey: string;
  downloadUrl?: string;
  bucketOrDir: string;
  success: boolean;
  error?: string;
}

export async function uploadBackup(
  config: BackupConfig,
  encryptedZipPath: string,
  backupId: string,
): Promise<UploadResult> {
  const fileName = path.basename(encryptedZipPath);
  const remoteKey = `archives/${fileName}`;

  // Check if S3 credentials are provided
  const hasS3Config =
    Boolean(config.s3AccessKeyId && config.s3SecretAccessKey) ||
    Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (hasS3Config) {
    try {
      const s3Client = new S3Client({
        region: config.s3Region,
        endpoint: config.s3Endpoint,
        credentials: config.s3AccessKeyId
          ? {
              accessKeyId: config.s3AccessKeyId,
              secretAccessKey: config.s3SecretAccessKey!,
            }
          : undefined,
        forcePathStyle: true,
      });

      const fileStream = fs.createReadStream(encryptedZipPath);
      const fileStats = await fsp.stat(encryptedZipPath);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: config.s3Bucket,
          Key: remoteKey,
          Body: fileStream,
          ContentLength: fileStats.size,
          ContentType: 'application/octet-stream',
          Metadata: {
            'backup-id': backupId,
            'created-at': new Date().toISOString(),
          },
        }),
      );

      // Generate a signed URL for download valid for 1 hour
      const downloadUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: remoteKey,
        }),
        { expiresIn: 3600 },
      );

      return {
        storageType: 's3',
        remoteKey,
        downloadUrl,
        bucketOrDir: config.s3Bucket,
        success: true,
      };
    } catch (err: any) {
      console.warn(`[Upload Backup] S3 upload failed, falling back to local archive storage: ${err.message}`);
    }
  }

  // Local fallback storage
  try {
    const permanentArchiveDir = path.resolve(process.cwd(), 'backups', 'storage', 'archives');
    await fsp.mkdir(permanentArchiveDir, { recursive: true });
    const localDest = path.join(permanentArchiveDir, fileName);
    await fsp.copyFile(encryptedZipPath, localDest);

    return {
      storageType: 'local',
      remoteKey: localDest,
      downloadUrl: `/api/admin/backups/download?file=${encodeURIComponent(fileName)}`,
      bucketOrDir: permanentArchiveDir,
      success: true,
    };
  } catch (err: any) {
    return {
      storageType: 'local',
      remoteKey: fileName,
      bucketOrDir: 'local',
      success: false,
      error: err.message,
    };
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/dal';
import { getBackupConfig } from '../../../../../../scripts/backup/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const searchParams = request.nextUrl.searchParams;
    const rawFile = searchParams.get('file');

    if (!rawFile) {
      return new NextResponse('اسم الملف مطلوب', { status: 400 });
    }

    // Security sanitization: strict basename only, prevent path traversal
    const safeName = path.basename(rawFile);
    if (!safeName.startsWith('RAWAQ-FULL-BACKUP-') || (!safeName.endsWith('.zip') && !safeName.endsWith('.zip.enc'))) {
      return new NextResponse('اسم ملف غير صالح أو غير مصرح به', { status: 400 });
    }

    const config = getBackupConfig();

    // Check if stored in S3
    if (config.s3AccessKeyId && config.s3SecretAccessKey) {
      const s3Client = new S3Client({
        region: config.s3Region,
        endpoint: config.s3Endpoint,
        credentials: {
          accessKeyId: config.s3AccessKeyId,
          secretAccessKey: config.s3SecretAccessKey,
        },
        forcePathStyle: true,
      });

      const presignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: `archives/${safeName}`,
        }),
        { expiresIn: 3600 },
      );

      return NextResponse.redirect(presignedUrl);
    }

    // Local storage streaming
    const localPath = path.resolve(process.cwd(), 'backups', 'storage', 'archives', safeName);
    try {
      const stat = await fsp.stat(localPath);
      const stream = fs.createReadStream(localPath);

      // Convert Node ReadStream to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${safeName}"`,
          'Content-Length': stat.size.toString(),
        },
      });
    } catch {
      return new NextResponse('الملف المطلوب غير موجود في التخزين', { status: 404 });
    }
  } catch (err: any) {
    return new NextResponse(err.message || 'غير مصرح', { status: 403 });
  }
}

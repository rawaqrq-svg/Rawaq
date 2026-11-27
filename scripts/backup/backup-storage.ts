import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { BackupConfig } from './config';

export interface StorageBackupResult {
  storageDir: string;
  summaryPath: string;
  totalFiles: number;
  totalSizeBytes: number;
  bucketStats: Record<string, { count: number; bytes: number }>;
  fileList: Array<{ bucket: string; path: string; size: number; sha256: string }>;
}

async function listAllFilesRecursively(
  supabase: any,
  bucket: string,
  prefix: string = '',
): Promise<Array<{ name: string; id?: string | null; metadata?: any }>> {
  const allFiles: Array<{ name: string; id?: string | null; metadata?: any }> = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      console.warn(`[Storage Backup] Warning listing bucket "${bucket}" prefix "${prefix}": ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;

    for (const item of data) {
      if (item.id === null) {
        const subPath = prefix ? `${prefix}/${item.name}` : item.name;
        const subFiles = await listAllFilesRecursively(supabase, bucket, subPath);
        allFiles.push(...subFiles);
      } else {
        const fullItemPath = prefix ? `${prefix}/${item.name}` : item.name;
        allFiles.push({ ...item, name: fullItemPath });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return allFiles;
}

export async function backupStorage(
  config: BackupConfig,
  outputDir: string,
): Promise<StorageBackupResult> {
  const storageDir = path.join(outputDir, 'storage');
  await fs.mkdir(storageDir, { recursive: true });

  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false },
  });

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    throw new Error(`Failed to list storage buckets: ${bucketError.message}`);
  }

  const bucketStats: Record<string, { count: number; bytes: number }> = {};
  const fileList: Array<{ bucket: string; path: string; size: number; sha256: string }> = [];
  let totalFiles = 0;
  let totalSizeBytes = 0;

  const CONCURRENCY = 15;

  for (const bucket of buckets || []) {
    bucketStats[bucket.name] = { count: 0, bytes: 0 };
    const bucketOutputDir = path.join(storageDir, bucket.name);
    await fs.mkdir(bucketOutputDir, { recursive: true });

    const files = await listAllFilesRecursively(supabase, bucket.name);

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const chunk = files.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (fileItem) => {
          try {
            const { data, error } = await supabase.storage.from(bucket.name).download(fileItem.name);
            if (error || !data) {
              console.warn(`[Storage Backup] Skipped ${bucket.name}/${fileItem.name}: ${error?.message}`);
              return;
            }

            const buffer = Buffer.from(await data.arrayBuffer());
            const hash = crypto.createHash('sha256').update(buffer).digest('hex');

            const localFilePath = path.join(bucketOutputDir, fileItem.name);
            await fs.mkdir(path.dirname(localFilePath), { recursive: true });
            await fs.writeFile(localFilePath, buffer);

            bucketStats[bucket.name].count++;
            bucketStats[bucket.name].bytes += buffer.length;
            totalFiles++;
            totalSizeBytes += buffer.length;

            fileList.push({
              bucket: bucket.name,
              path: fileItem.name,
              size: buffer.length,
              sha256: hash,
            });
          } catch (err: any) {
            console.warn(`[Storage Backup] Error downloading ${bucket.name}/${fileItem.name}: ${err.message}`);
          }
        }),
      );
    }
  }

  const summaryPath = path.join(storageDir, 'storage-summary.json');
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalFiles,
        totalSizeBytes,
        buckets: bucketStats,
      },
      null,
      2,
    ),
    'utf-8',
  );

  return {
    storageDir,
    summaryPath,
    totalFiles,
    totalSizeBytes,
    bucketStats,
    fileList,
  };
}

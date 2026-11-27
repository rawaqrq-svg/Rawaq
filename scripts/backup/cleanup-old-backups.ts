import fsp from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { BackupConfig } from './config';

export interface CleanupResult {
  retainedBackups: string[];
  prunedBackups: string[];
  success: boolean;
  warnings?: string[];
}

export async function cleanupOldBackups(
  config: BackupConfig,
  currentBackupId: string,
): Promise<CleanupResult> {
  const warnings: string[] = [];
  const client = new Client({
    connectionString: config.neonDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // 1. Fetch active backups sorted by date DESC
    const res = await client.query<{
      backup_id: string;
      schema_name: string;
      created_at: Date;
    }>(`
      SELECT backup_id, schema_name, created_at 
      FROM public.rawaq_backups_metadata 
      WHERE status IN ('RESTORED', 'VERIFIED')
      ORDER BY created_at DESC;
    `);

    const activeBackups = res.rows;
    const retentionLimit = config.retentionCount; // 2

    // If active backups are within retention limit, nothing to prune
    if (activeBackups.length <= retentionLimit) {
      return {
        retainedBackups: activeBackups.map((b) => b.backup_id),
        prunedBackups: [],
        success: true,
      };
    }

    // Keep the top N backups, prune the rest (starting with the oldest)
    const retained = activeBackups.slice(0, retentionLimit);
    const toPrune = activeBackups.slice(retentionLimit);
    const prunedIds: string[] = [];

    // Optional S3 Client for archive pruning
    let s3Client: S3Client | null = null;
    if (config.s3AccessKeyId && config.s3SecretAccessKey) {
      s3Client = new S3Client({
        region: config.s3Region,
        endpoint: config.s3Endpoint,
        credentials: {
          accessKeyId: config.s3AccessKeyId,
          secretAccessKey: config.s3SecretAccessKey,
        },
        forcePathStyle: true,
      });
    }

    const localArchiveDir = path.resolve(process.cwd(), 'backups', 'storage', 'archives');

    for (const item of toPrune) {
      // Safety assertion: NEVER drop public or system schemas
      if (!item.schema_name.startsWith('backup_') || item.schema_name === 'public') {
        warnings.push(`تخطي حذف المخطط غير المصرح بحذفه: ${item.schema_name}`);
        continue;
      }

      try {
        // Drop isolated schema in Neon
        await client.query(`DROP SCHEMA IF EXISTS "${item.schema_name}" CASCADE;`);

        // Mark as pruned in Neon metadata
        await client.query(
          `UPDATE public.rawaq_backups_metadata 
           SET status = 'PRUNED', pruned_at = NOW() 
           WHERE backup_id = $1`,
          [item.backup_id],
        );

        prunedIds.push(item.backup_id);

        // Delete archive from S3 if configured
        if (s3Client) {
          const encKey = `archives/RAWAQ-FULL-BACKUP-${item.backup_id}.zip.enc`;
          await s3Client
            .send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: encKey }))
            .catch((err) => warnings.push(`S3 delete warning for ${encKey}: ${err.message}`));
        }

        // Delete local archive if present
        const localZip = path.join(localArchiveDir, `RAWAQ-FULL-BACKUP-${item.backup_id}.zip`);
        const localZipEnc = path.join(localArchiveDir, `RAWAQ-FULL-BACKUP-${item.backup_id}.zip.enc`);
        await fsp.unlink(localZip).catch(() => {});
        await fsp.unlink(localZipEnc).catch(() => {});
      } catch (err: any) {
        warnings.push(`خطأ أثناء حذف النسخة القديمة ${item.backup_id}: ${err.message}`);
      }
    }

    return {
      retainedBackups: retained.map((b) => b.backup_id),
      prunedBackups: prunedIds,
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: any) {
    return {
      retainedBackups: [],
      prunedBackups: [],
      success: false,
      warnings: [err.message],
    };
  } finally {
    await client.end();
  }
}

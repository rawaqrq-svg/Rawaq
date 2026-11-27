import fs from 'node:fs/promises';
import path from 'node:path';
import { getBackupConfig } from './config';
import { dumpDatabase } from './dump-database';
import { backupStorage } from './backup-storage';
import { createArchive } from './create-archive';
import { restoreToNeon } from './restore-to-neon';
import { verifyBackup } from './verify-backup';
import { uploadBackup } from './upload-backup';
import { cleanupOldBackups } from './cleanup-old-backups';
import { notificationService } from '../../src/services/notification-service';
import { prisma } from '../../src/lib/db';

function generateBackupId(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `BKP-${yyyy}${mm}${dd}-${rand}`;
}

export async function runFullBackup(): Promise<{ success: boolean; backupId: string; error?: string }> {
  const startTime = Date.now();
  const config = getBackupConfig();
  const backupId = generateBackupId();

  console.log(`=======================================================`);
  console.log(`[RAWAQ Backup] Starting backup process: ${backupId}`);
  console.log(`[RAWAQ Backup] Time: ${new Date().toISOString()}`);
  console.log(`=======================================================`);

  // Staging directories
  const baseWorkDir = path.resolve(process.cwd(), 'backups', 'temp', backupId);
  const stageDir = path.join(baseWorkDir, 'stage');
  const archivesDir = path.resolve(process.cwd(), 'backups', 'archives');
  const tempVerifyDir = path.join(baseWorkDir, 'verify');

  await fs.mkdir(stageDir, { recursive: true });
  await fs.mkdir(archivesDir, { recursive: true });

  // 1. Log Start to AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        action: 'BACKUP_STARTED',
        entityType: 'Backup',
        entityId: backupId,
        category: 'SECURITY',
        actorType: 'SYSTEM',
        actorNameSnapshot: 'النظام الآلي لحماية البيانات',
        outcome: 'SUCCESS',
        severity: 'NORMAL',
        details: JSON.stringify({ backupId, startedAt: new Date().toISOString() }),
      },
    });
  } catch (err) {
    console.warn('[RAWAQ Backup] Could not record initial audit log:', err);
  }

  let failedStage = '';
  let errorMessage = '';

  try {
    // 2. Dump Supabase Database
    console.log(`[1/7] Dumping Supabase Database...`);
    failedStage = 'نسخ قاعدة بيانات Supabase';
    const dumpResult = await dumpDatabase(config, stageDir);
    console.log(`✓ Database dumped: ${dumpResult.tableCount} tables, ${dumpResult.totalRows} rows.`);

    // 3. Backup Supabase Storage Files
    console.log(`[2/7] Backing up Supabase Storage buckets...`);
    failedStage = 'نسخ ملفات Supabase Storage';
    const storageResult = await backupStorage(config, stageDir);
    console.log(`✓ Storage backed up: ${storageResult.totalFiles} files (${storageResult.totalSizeBytes} bytes).`);

    // 4. Create and Encrypt ZIP Archive
    console.log(`[3/7] Building and encrypting archive...`);
    failedStage = 'إنشاء وتشفير ملف ZIP';
    const archiveResult = await createArchive(config, stageDir, backupId, archivesDir);
    console.log(`✓ Archive created & encrypted: ${archiveResult.encryptedSizeBytes} bytes.`);

    // 5. Restore Database to Neon in Isolated Schema
    console.log(`[4/7] Restoring dump to dedicated Neon schema...`);
    failedStage = 'استعادة قاعدة البيانات إلى Neon';
    const neonResult = await restoreToNeon(config, dumpResult.dumpSqlPath, backupId);
    if (!neonResult.success) {
      throw new Error(`Neon restore failed: ${neonResult.error}`);
    }
    console.log(`✓ Neon schema "${neonResult.schemaName}" restored: ${neonResult.restoredRowsCount} rows.`);

    // 6. Verify Backup Integrity
    console.log(`[5/7] Verifying data consistency and integrity...`);
    failedStage = 'التحقق والمطابقة النهائية';
    const verifyResult = await verifyBackup(
      config,
      dumpResult,
      neonResult,
      storageResult,
      archiveResult,
      tempVerifyDir,
    );

    if (!verifyResult.valid) {
      throw new Error(`Verification errors:\n${verifyResult.errors.join('\n')}`);
    }
    console.log(`✓ Verification passed 100%: All ${verifyResult.matchedTablesCount} tables match.`);

    // 7. Upload to Cloud Storage (S3 / R2 / Local)
    console.log(`[6/7] Uploading archive to independent storage...`);
    failedStage = 'حفظ الأرشيف في التخزين الخارجي';
    const uploadResult = await uploadBackup(config, archiveResult.encryptedZipPath, backupId);
    console.log(`✓ Upload complete via ${uploadResult.storageType}: ${uploadResult.remoteKey}`);

    // 8. Enforce Strict 2-Backup Retention Policy
    console.log(`[7/7] Enforcing 2-backup retention policy...`);
    failedStage = 'تنظيف النسخ الأقدم';
    const cleanupResult = await cleanupOldBackups(config, backupId);
    console.log(`✓ Retention enforced: Retained [${cleanupResult.retainedBackups.join(', ')}]`);
    if (cleanupResult.prunedBackups.length > 0) {
      console.log(`✓ Pruned oldest backup(s): [${cleanupResult.prunedBackups.join(', ')}]`);
    }

    // 9. Send Success Notification via Resend
    const durationSeconds = (Date.now() - startTime) / 1000;
    const nextDate = new Date(Date.now() + config.intervalHours * 60 * 60 * 1000);
    const nextScheduled = nextDate.toLocaleString('ar-JO', { timeZone: config.timezone });

    await notificationService.notifyBackupSuccess({
      backupId,
      date: new Date().toLocaleDateString('ar-JO', { timeZone: config.timezone }),
      startTime: new Date(startTime).toLocaleTimeString('ar-JO', { timeZone: config.timezone }),
      durationSeconds,
      totalSizeBytes: archiveResult.encryptedSizeBytes,
      tableCount: dumpResult.tableCount,
      totalRows: dumpResult.totalRows,
      storageFilesCount: storageResult.totalFiles,
      retainedBackups: cleanupResult.retainedBackups,
      prunedBackupId: cleanupResult.prunedBackups[0],
      nextScheduledBackup: nextScheduled,
    });

    // 10. Audit Log Final Success
    try {
      await prisma.auditLog.create({
        data: {
          action: 'BACKUP_SUCCESS',
          entityType: 'Backup',
          entityId: backupId,
          category: 'SECURITY',
          actorType: 'SYSTEM',
          actorNameSnapshot: 'النظام الآلي لحماية البيانات',
          outcome: 'SUCCESS',
          severity: 'NORMAL',
          details: JSON.stringify({
            backupId,
            durationSeconds,
            totalRows: dumpResult.totalRows,
            storageFiles: storageResult.totalFiles,
            archiveSize: archiveResult.encryptedSizeBytes,
            neonSchema: neonResult.schemaName,
            retainedBackups: cleanupResult.retainedBackups,
            prunedBackups: cleanupResult.prunedBackups,
            uploadType: uploadResult.storageType,
          }),
        },
      });
    } catch {
      // Ignore
    }

    // Cleanup temp staging directory
    await fs.rm(baseWorkDir, { recursive: true, force: true }).catch(() => {});

    console.log(`=======================================================`);
    console.log(`[RAWAQ Backup] Backup ${backupId} completed successfully in ${durationSeconds.toFixed(1)}s!`);
    console.log(`=======================================================`);

    return { success: true, backupId };
  } catch (err: any) {
    errorMessage = err.message || 'Unknown error during backup';
    console.error(`[RAWAQ Backup] Backup ${backupId} failed at stage "${failedStage}":`, errorMessage);

    // Fetch existing retained backups from Neon metadata
    let existingRetained: string[] = [];
    try {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: config.neonDatabaseUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();
      const res = await client.query<{ backup_id: string }>(
        `SELECT backup_id FROM public.rawaq_backups_metadata WHERE status IN ('RESTORED', 'VERIFIED') ORDER BY created_at DESC LIMIT 2`,
      );
      existingRetained = res.rows.map((r) => r.backup_id);
      await client.end();
    } catch {
      // Ignore
    }

    // Send Alert Email via Resend
    await notificationService.notifyBackupFailure({
      backupId,
      stage: failedStage,
      errorMessage,
      nextRetry: 'إعادة المحاولة مجدولة تلقائياً بعد 15 دقيقة',
      retainedBackups: existingRetained.length > 0 ? existingRetained : ['النسخ الاحتياطية السابقة محفوظة بأمان'],
    });

    // Audit Log Failure
    try {
      await prisma.auditLog.create({
        data: {
          action: 'BACKUP_FAILED',
          entityType: 'Backup',
          entityId: backupId,
          category: 'SECURITY',
          actorType: 'SYSTEM',
          actorNameSnapshot: 'النظام الآلي لحماية البيانات',
          outcome: 'FAILED',
          severity: 'CRITICAL',
          details: JSON.stringify({
            backupId,
            failedStage,
            errorMessage,
            retainedBackups: existingRetained,
          }),
        },
      });
    } catch {
      // Ignore
    }

    // Cleanup temp files
    await fs.rm(baseWorkDir, { recursive: true, force: true }).catch(() => {});

    return { success: false, backupId, error: errorMessage };
  }
}

// Allow CLI execution: `npx tsx scripts/backup/run-backup.ts`
if (require.main === module || process.argv[1]?.endsWith('run-backup.ts')) {
  runFullBackup()
    .then((res) => {
      if (!res.success) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

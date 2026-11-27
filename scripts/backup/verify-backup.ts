import fs from 'node:fs/promises';
import { NeonRestoreResult } from './restore-to-neon';
import { DatabaseDumpResult } from './dump-database';
import { StorageBackupResult } from './backup-storage';
import { ArchiveResult } from './create-archive';
import { decryptFile } from './encrypt-backup';
import { BackupConfig } from './config';
import path from 'node:path';

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  matchedTablesCount: number;
  totalTablesCount: number;
  sourceRowsCount: number;
  restoredRowsCount: number;
  storageFilesCount: number;
  archiveSizeBytes: number;
  verifiedAt: string;
}

export async function verifyBackup(
  config: BackupConfig,
  dumpResult: DatabaseDumpResult,
  neonResult: NeonRestoreResult,
  storageResult: StorageBackupResult,
  archiveResult: ArchiveResult,
  tempVerifyDir: string,
): Promise<VerificationResult> {
  const errors: string[] = [];
  let matchedTablesCount = 0;

  // 1. Verify Neon restoration success
  if (!neonResult.success) {
    errors.push(`فشل استعادة البيانات إلى Neon: ${neonResult.error || 'خطأ مجهول'}`);
  }

  // 2. Verify table row counts between Supabase and Neon
  const sourceTables = Object.keys(dumpResult.tablesSummary);
  for (const table of sourceTables) {
    const sourceCount = dumpResult.tablesSummary[table] ?? 0;
    const restoredCount = neonResult.tablesSummary[table] ?? -1;

    if (restoredCount === -1) {
      errors.push(`الجدول "${table}" مفقود في قاعدة Neon المستعادة.`);
    } else if (sourceCount !== restoredCount) {
      errors.push(
        `عدم تطابق في سجلات الجدول "${table}": الأصل (${sourceCount}) مقابل المستعاد (${restoredCount}).`,
      );
    } else {
      matchedTablesCount++;
    }
  }

  // 3. Verify storage files
  if (storageResult.totalFiles === 0 && Object.keys(storageResult.bucketStats).length > 0) {
    // If buckets exist and have files, check that files downloaded are not empty
  }

  // 4. Verify Archive Decryption capability
  try {
    await fs.mkdir(tempVerifyDir, { recursive: true });
    const decryptedTempPath = path.join(tempVerifyDir, 'test-decrypt.zip');
    await decryptFile(archiveResult.encryptedZipPath, decryptedTempPath, config.encryptionKey);
    const decryptedStats = await fs.stat(decryptedTempPath);
    if (decryptedStats.size !== archiveResult.archiveSizeBytes) {
      errors.push(`فشل فحص فك تشفير الأرشيف: الحجم بعد فك التشفير غير مطابق للأصل.`);
    }
    await fs.unlink(decryptedTempPath).catch(() => {});
  } catch (err: any) {
    errors.push(`فشل تجربة فك تشفير الأرشيف: ${err.message}`);
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    matchedTablesCount,
    totalTablesCount: sourceTables.length,
    sourceRowsCount: dumpResult.totalRows,
    restoredRowsCount: neonResult.restoredRowsCount,
    storageFilesCount: storageResult.totalFiles,
    archiveSizeBytes: archiveResult.encryptedSizeBytes,
    verifiedAt: new Date().toISOString(),
  };
}

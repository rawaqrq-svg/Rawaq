import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { encryptFile } from './encrypt-backup';
import { BackupConfig } from './config';

export interface ArchiveResult {
  zipPath: string;
  encryptedZipPath: string;
  archiveSizeBytes: number;
  encryptedSizeBytes: number;
  zipSha256: string;
  encryptedSha256: string;
  manifestPath: string;
}

async function getZipArchiveInstance(options: any = { zlib: { level: 9 } }) {
  const archiverModule: any = await import('archiver');
  if (typeof archiverModule.ZipArchive === 'function') {
    return new archiverModule.ZipArchive(options);
  }
  if (typeof archiverModule.default === 'function') {
    return archiverModule.default('zip', options);
  }
  if (typeof archiverModule === 'function') {
    return archiverModule('zip', options);
  }
  throw new Error('Unsupported archiver module exports');
}

async function computeSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath, baseDir)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export async function createArchive(
  config: BackupConfig,
  stageDir: string,
  backupId: string,
  outputDir: string,
): Promise<ArchiveResult> {
  // 1. Prepare configuration directory (strictly without secrets)
  const configDir = path.join(stageDir, 'configuration');
  await fsp.mkdir(configDir, { recursive: true });
  await fsp.writeFile(
    path.join(configDir, 'system-config.json'),
    JSON.stringify(
      {
        backupId,
        storeName: 'رَواق | RAWAQ',
        version: '1.0.0',
        environment: 'production',
        timezone: config.timezone,
        retentionPolicy: `${config.retentionCount} backups`,
        scheduleInterval: `${config.intervalHours} hours`,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  );

  // 2. Prepare auth metadata directory
  const authDir = path.join(stageDir, 'auth');
  await fsp.mkdir(authDir, { recursive: true });
  await fsp.writeFile(
    path.join(authDir, 'auth-metadata.json'),
    JSON.stringify(
      {
        provider: 'Supabase Auth & Custom ERP Roles',
        rolesSummary: 'ADMIN, SUPER ADMIN, MANAGER, CASHIER, SUPPLIER',
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  );

  // 3. Prepare RESTORE-GUIDE.md inside the archive
  const restoreGuideContent = `# دليل استعادة بيانات رَواق | RAWAQ Disaster Recovery Guide
رقم النسخة: ${backupId}
تاريخ الإنشاء: ${new Date().toISOString()}

## خطوات الاستعادة السريعة
1. فك تشفير الملف باستخدام مفتاح التشفير المعتمد:
   node scripts/backup/encrypt-backup.js --decrypt RAWAQ-FULL-BACKUP-${backupId}.zip.enc
2. فك ضغط ملف ZIP.
3. استعادة قاعدة البيانات إلى PostgreSQL:
   psql -h <HOST> -U <USER> -d <DB> -f database/dump.sql
4. إعادة رفع ملفات Storage إلى الحاويات الخاصة بها عبر واجهة Supabase أو سكريبت الاستعادة.
5. التحقق من مطابقة السجلات عبر manifest.json و checksums.sha256.
`;
  await fsp.writeFile(path.join(stageDir, 'RESTORE-GUIDE.md'), restoreGuideContent, 'utf-8');

  // 4. Calculate checksums for all files in staging
  const allStagedFiles = await getAllFiles(stageDir);
  const checksumLines: string[] = [];
  const manifestFiles: Record<string, { size: number; sha256: string }> = {};

  for (const f of allStagedFiles) {
    const relPath = path.relative(stageDir, f).replace(/\\/g, '/');
    const hash = await computeSha256(f);
    const stat = await fsp.stat(f);
    checksumLines.push(`${hash}  ${relPath}`);
    manifestFiles[relPath] = { size: stat.size, sha256: hash };
  }

  const checksumsPath = path.join(stageDir, 'checksums.sha256');
  await fsp.writeFile(checksumsPath, checksumLines.join('\n'), 'utf-8');

  // 5. Build manifest.json
  const manifestPath = path.join(stageDir, 'manifest.json');
  const manifest = {
    backupId,
    store: 'رَواق | RAWAQ',
    createdAt: new Date().toISOString(),
    totalFiles: Object.keys(manifestFiles).length,
    files: manifestFiles,
  };
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // 6. Create ZIP archive
  await fsp.mkdir(outputDir, { recursive: true });
  const zipName = `RAWAQ-FULL-BACKUP-${backupId}.zip`;
  const zipPath = path.join(outputDir, zipName);
  const archive = await getZipArchiveInstance({ zlib: { level: 9 } });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);

    output.on('close', () => resolve());
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);
    archive.directory(stageDir, false);
    archive.finalize();
  });

  const zipStats = await fsp.stat(zipPath);
  const zipSha256 = await computeSha256(zipPath);

  // 7. Encrypt the ZIP file
  const encZipName = `${zipName}.enc`;
  const encryptedZipPath = path.join(outputDir, encZipName);

  await encryptFile(zipPath, encryptedZipPath, config.encryptionKey);

  const encStats = await fsp.stat(encryptedZipPath);
  const encryptedSha256 = await computeSha256(encryptedZipPath);

  return {
    zipPath,
    encryptedZipPath,
    archiveSizeBytes: zipStats.size,
    encryptedSizeBytes: encStats.size,
    zipSha256,
    encryptedSha256,
    manifestPath,
  };
}

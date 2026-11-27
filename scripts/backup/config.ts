import 'dotenv/config';

export interface BackupConfig {
  supabaseDirectUrl: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  neonDatabaseUrl: string;
  s3Endpoint?: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  encryptionKey: string;
  retentionCount: number;
  intervalHours: number;
  timezone: string;
  resendApiKey: string;
  resendOrdersFrom: string;
  resendBackupFrom: string;
  resendSecurityFrom: string;
  resendFallbackFrom: string;
  adminNotificationEmail: string;
  appUrl: string;
}

export function getBackupConfig(): BackupConfig {
  const supabaseDirectUrl =
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    '';

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://mvvsofjitybxjhxorruw.supabase.co';

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  const neonDatabaseUrl =
    process.env.NEON_BACKUP_DATABASE_URL ||
    process.env.DATABASE_URL_BACKUP ||
    '';

  const s3Endpoint = process.env.BACKUP_S3_ENDPOINT || undefined;
  const s3Bucket = process.env.BACKUP_S3_BUCKET || 'rawaq-backups';
  const s3Region = process.env.BACKUP_S3_REGION || 'auto';
  const s3AccessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID || undefined;
  const s3SecretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY || undefined;

  // Use configured key or default project encryption salt
  const encryptionKey =
    process.env.BACKUP_ENCRYPTION_KEY ||
    'rawaq-secure-backup-aes-key-2026-secret-vault';

  const retentionCount = parseInt(process.env.BACKUP_RETENTION_COUNT || '2', 10);
  const intervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS || '48', 10);
  const timezone = process.env.BACKUP_TIMEZONE || 'Asia/Amman';

  const resendApiKey =
    process.env.RESEND_API_KEY ||
    '';

  const resendOrdersFrom = process.env.RESEND_ORDERS_FROM || 'onboarding@resend.dev';
  const resendBackupFrom = process.env.RESEND_BACKUP_FROM || 'onboarding@resend.dev';
  const resendSecurityFrom = process.env.RESEND_SECURITY_FROM || 'onboarding@resend.dev';
  const resendFallbackFrom = process.env.RESEND_FALLBACK_FROM || 'onboarding@resend.dev';
  const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'rawaq.rq@gmail.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.rawaq-jo.online';

  return {
    supabaseDirectUrl,
    supabaseUrl,
    supabaseSecretKey,
    neonDatabaseUrl,
    s3Endpoint,
    s3Bucket,
    s3Region,
    s3AccessKeyId,
    s3SecretAccessKey,
    encryptionKey,
    retentionCount,
    intervalHours,
    timezone,
    resendApiKey,
    resendOrdersFrom,
    resendBackupFrom,
    resendSecurityFrom,
    resendFallbackFrom,
    adminNotificationEmail,
    appUrl,
  };
}

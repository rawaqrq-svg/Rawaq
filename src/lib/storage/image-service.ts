import sharp from 'sharp';
import path from 'path';
import { setDefaultResultOrder } from 'node:dns';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vercel can prefer an unreachable IPv6 route for Supabase's Cloudflare endpoint.
// Storage uploads then surface only the unhelpful `fetch failed` message.
setDefaultResultOrder('ipv4first');

// Supabase client instance caching
let supabaseAdminInstance: SupabaseClient | null = null;

const SUPABASE_FETCH_TIMEOUT_MS = 30_000;
const SUPABASE_FETCH_ATTEMPTS = 4;

function describeFetchError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? 'unknown error');
  const candidate = error as { message?: unknown; cause?: { code?: unknown; message?: unknown } };
  const message = typeof candidate.message === 'string' ? candidate.message : 'unknown error';
  const cause = candidate.cause;
  if (!cause) return message;
  const causeMessage = typeof cause.message === 'string' ? cause.message : '';
  const causeCode = typeof cause.code === 'string' ? cause.code : '';
  return [message, causeCode, causeMessage].filter(Boolean).join(' | ');
}

async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SUPABASE_FETCH_ATTEMPTS; attempt++) {
    try {
      const headers = new Headers(init?.headers);
      // Avoid reusing a broken socket between serverless invocations.
      headers.set('connection', 'close');
      return await fetch(input, {
        ...init,
        signal: init?.signal || AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
        headers,
      });
    } catch (error) {
      lastError = error;
      console.warn(`[Supabase Storage] fetch attempt ${attempt}/${SUPABASE_FETCH_ATTEMPTS} failed: ${describeFetchError(error)}`);
      if (attempt < SUPABASE_FETCH_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(describeFetchError(lastError));
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.SUPABASE_SECRET_KEY || '';

  if (!url || !key || url === 'https://dummy.supabase.co') {
    return null;
  }

  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: supabaseFetch },
    });
  }

  return supabaseAdminInstance;
}

// Track created buckets to avoid excessive listBuckets API calls
const verifiedBuckets = new Set<string>();

async function ensureSupabaseBucket(supabase: SupabaseClient, bucketName: string): Promise<void> {
  if (verifiedBuckets.has(bucketName)) return;

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn('Could not list Supabase buckets:', listError.message);
      return;
    }

    if (!buckets?.some(b => b.name === bucketName)) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
      });
      if (createError) {
        console.warn(`Could not create bucket ${bucketName}:`, createError.message);
      } else {
        verifiedBuckets.add(bucketName);
      }
    } else {
      verifiedBuckets.add(bucketName);
    }
  } catch (err) {
    console.warn('Bucket verification warning:', err);
  }
}

function isTransientUploadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /fetch failed|network|timeout|socket|econnreset|eai_again/i.test(message);
}

export interface OptimizationResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  isWebpConverted: boolean;
  originalSize: number;
  optimizedSize: number;
  savedPercentage: number;
}

const RASTER_IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.bmp', '.heic', '.heif', '.gif'
]);

/**
 * Automatically converts raster images into next-gen WebP format (quality: 80)
 * preserving quality while drastically reducing payload size (by 25-34%+).
 */
export async function optimizeImageToWebp(
  inputBuffer: Buffer,
  originalFilename: string,
  quality: number = 80
): Promise<OptimizationResult> {
  const ext = path.extname(originalFilename).toLowerCase();
  const originalSize = inputBuffer.byteLength;

  // Non-raster or non-image files (e.g. svg, mp4, pdf) remain untouched
  if (!RASTER_IMAGE_EXTENSIONS.has(ext)) {
    return {
      buffer: inputBuffer,
      contentType: ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream',
      extension: ext || '.bin',
      isWebpConverted: false,
      originalSize,
      optimizedSize: originalSize,
      savedPercentage: 0,
    };
  }

  try {
    // If animated GIF or animated WebP, process with animated support
    const isGif = ext === '.gif';
    const pipeline = sharp(inputBuffer, { animated: isGif });

    const webpBuffer = await pipeline
      .webp({
        quality,
        effort: 4, // Balanced speed vs compression
      })
      .toBuffer();

    const optimizedSize = webpBuffer.byteLength;
    const savedPercentage = originalSize > 0 
      ? Math.max(0, Math.round(((originalSize - optimizedSize) / originalSize) * 100))
      : 0;

    return {
      buffer: webpBuffer,
      contentType: 'image/webp',
      extension: '.webp',
      isWebpConverted: true,
      originalSize,
      optimizedSize,
      savedPercentage,
    };
  } catch (conversionError) {
    console.warn(`Sharp WebP conversion warning for ${originalFilename}:`, conversionError);
    // If sharp conversion fails for any edge case, gracefully return original buffer
    return {
      buffer: inputBuffer,
      contentType: 'application/octet-stream',
      extension: ext,
      isWebpConverted: false,
      originalSize,
      optimizedSize: originalSize,
      savedPercentage: 0,
    };
  }
}

export interface UploadOptions {
  file: File | Buffer;
  filename: string;
  bucket?: string;
  folder?: string;
  quality?: number;
  forceWebp?: boolean;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  fileName?: string;
  bucket?: string;
  format?: string;
  originalSize?: number;
  optimizedSize?: number;
  savedPercentage?: number;
  error?: string;
}

/**
 * High-performance centralized upload service with automatic WebP conversion.
 * Uploads to Supabase Storage. Production media never falls back to local or S3 storage.
 */
export async function uploadAndOptimizeFile(options: UploadOptions): Promise<UploadResult> {
  try {
    const rawBuffer = Buffer.isBuffer(options.file)
      ? options.file
      : Buffer.from(await options.file.arrayBuffer());

    if (!rawBuffer || rawBuffer.byteLength === 0) {
      return { success: false, error: 'الملف فارغ أو غير صالح' };
    }

    const bucket = options.bucket || 'product-images';
    const folder = options.folder ? `${options.folder.replace(/^\/+|\/+$/g, '')}/` : '';
    const shouldOptimize = options.forceWebp !== false;

    // 1. Convert to WebP if image
    let processResult: OptimizationResult;
    if (shouldOptimize) {
      processResult = await optimizeImageToWebp(rawBuffer, options.filename, options.quality ?? 80);
    } else {
      const ext = path.extname(options.filename).toLowerCase();
      processResult = {
        buffer: rawBuffer,
        contentType: 'application/octet-stream',
        extension: ext,
        isWebpConverted: false,
        originalSize: rawBuffer.byteLength,
        optimizedSize: rawBuffer.byteLength,
        savedPercentage: 0,
      };
    }

    // 2. Generate clean, collision-free filename
    const baseName = path.basename(options.filename, path.extname(options.filename))
      .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')
      .slice(0, 40);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const finalFileName = `${folder}${baseName ? `${baseName}-` : ''}${uniqueSuffix}${processResult.extension}`;

    // 3. Supabase Storage is the single media source of truth.
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await ensureSupabaseBucket(supabase, bucket);

      let uploadError: { message: string } | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await supabase.storage.from(bucket).upload(finalFileName, processResult.buffer, {
          contentType: processResult.contentType,
          // Supabase expects this option to be the max-age in seconds.
          cacheControl: '31536000',
          upsert: true,
        });
        uploadError = response.error;
        if (!uploadError || !isTransientUploadError(uploadError.message) || attempt === 3) break;
        await new Promise(resolve => setTimeout(resolve, attempt * 250));
      }

      if (uploadError) {
        throw new Error(`خطأ أثناء رفع الصورة إلى Supabase (${bucket}): ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(finalFileName);

      return {
        success: true,
        url: publicUrlData.publicUrl,
        key: finalFileName,
        fileName: finalFileName,
        bucket,
        format: processResult.extension.replace('.', ''),
        originalSize: processResult.originalSize,
        optimizedSize: processResult.optimizedSize,
        savedPercentage: processResult.savedPercentage,
      };
    }

    return {
      success: false,
      error: 'Supabase Storage غير مهيأ. يلزم SUPABASE_SERVICE_ROLE_KEY أو SUPABASE_SECRET_KEY.',
    };
  } catch (error: any) {
    console.error('uploadAndOptimizeFile Error:', error);
    return {
      success: false,
      error: error?.message || 'حدث خطأ غير متوقع أثناء معالجة ورفع الملف',
    };
  }
}

import sharp from 'sharp';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getObjectStorageClient, hasObjectStorageConfig, mediaUrlForKey, uploadsBucket } from '@/lib/object-storage';

// Supabase client instance caching
let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.SUPABASE_SECRET_KEY || 
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key || url === 'https://dummy.supabase.co') {
    return null;
  }

  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(url, key, {
      auth: { persistSession: false },
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
 * Uploads to Supabase Storage with graceful fallback to Neon S3.
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

    // 3. Storage Destination: Primary is Supabase Storage
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await ensureSupabaseBucket(supabase, bucket);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(finalFileName, processResult.buffer, {
          contentType: processResult.contentType,
          cacheControl: 'public, max-age=31536000, immutable',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`خطأ أثناء رفع الصورة إلى Supabase: ${uploadError.message}`);
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

    // 4. Fallback: Neon S3 Object Storage
    if (hasObjectStorageConfig()) {
      const s3Key = `${bucket}/${finalFileName}`;
      await getObjectStorageClient().send(
        new PutObjectCommand({
          Bucket: uploadsBucket,
          Key: s3Key,
          Body: processResult.buffer,
          ContentType: processResult.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      return {
        success: true,
        url: mediaUrlForKey(s3Key),
        key: s3Key,
        fileName: finalFileName,
        bucket,
        format: processResult.extension.replace('.', ''),
        originalSize: processResult.originalSize,
        optimizedSize: processResult.optimizedSize,
        savedPercentage: processResult.savedPercentage,
      };
    }

    // 5. Fallback: Local filesystem for dev only
    if (process.env.NODE_ENV !== 'production') {
      const fs = await import('fs');
      const localDir = path.join(process.cwd(), 'public', 'uploads', bucket);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localDir, path.basename(finalFileName)), processResult.buffer);

      return {
        success: true,
        url: `/uploads/${bucket}/${path.basename(finalFileName)}`,
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
      error: 'لا توجد خدمة تخزين سحابي مهيأة (Supabase أو S3 مفقودة)',
    };
  } catch (error: any) {
    console.error('uploadAndOptimizeFile Error:', error);
    return {
      success: false,
      error: error?.message || 'حدث خطأ غير متوقع أثناء معالجة ورفع الملف',
    };
  }
}

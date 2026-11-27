'use server';

import { requireAuth, getEmployeePermissions } from '@/lib/dal';
import { createClient } from '@supabase/supabase-js';
import { uploadAndOptimizeFile } from '@/lib/storage/image-service';
import path from 'path';

async function requireUploadPermission() {
  const session = await requireAuth();
  const roleName = session.employee.role.name.trim().toUpperCase().replace(/[_-]+/g, ' ');
  if (roleName === 'ADMIN' || roleName === 'SUPER ADMIN' || roleName === 'أدمن رئيسي' || roleName === 'ادمن رئيسي') {
    return session;
  }
  const granted = await getEmployeePermissions(session.employeeId);
  const allowed = ['manage:settings', 'manage:products', 'manage:categories', 'manage:brands', 'manage:cms'];
  if (allowed.some(p => granted.includes(p))) {
    return session;
  }
  throw new Error(`Unauthorized Access: ${roleName} does not have upload permission`);
}

// Setup Supabase admin client for direct signed URL generation if needed
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.SUPABASE_SECRET_KEY || '';

  if (!url || !key || url === 'https://dummy.supabase.co') {
    throw new Error('مفاتيح Supabase غير مهيأة.');
  }

  return createClient(url, key, { auth: { persistSession: false } });
};

export async function generateUploadUrl(filename: string): Promise<{ success: boolean; token?: string; path?: string; publicUrl?: string; error?: string }> {
  try {
    await requireUploadPermission();

    let ext = '';
    const lastDot = filename.lastIndexOf('.');
    if (lastDot !== -1) {
      ext = filename.substring(lastDot).toLowerCase();
    }
    
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.ogg'];
    if (!allowedExts.includes(ext)) {
      return { success: false, error: 'صيغة الملف غير مدعومة' };
    }

    const newFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    const bucketName = 'uploads';
    const supabaseAdmin = getSupabaseAdmin();

    // Ensure bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw new Error('فشل جلب الحاويات: ' + listError.message);
    
    if (!buckets?.find(b => b.name === bucketName)) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, { public: true });
      if (createError) {
        throw new Error(`فشل إنشاء الحاوية: ` + createError.message);
      }
    }

    // Create a signed upload URL valid for 5 minutes
    const { data, error } = await supabaseAdmin.storage.from(bucketName).createSignedUploadUrl(newFilename);

    if (error || !data) {
      throw new Error(error?.message || 'فشل في إنشاء رابط الرفع');
    }

    const { data: publicData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(newFilename);

    return { 
      success: true, 
      token: data.token,
      path: data.path,
      publicUrl: publicData.publicUrl 
    };
  } catch (error: any) {
    console.error('Upload Error:', error);
    return { success: false, error: error?.message || 'حدث خطأ أثناء إعداد رابط الرفع' };
  }
}

/**
 * Universal media upload server action.
 * Automatically converts raster images to .webp (quality: 80) via Sharp,
 * saving 25-34%+ bandwidth and optimizing page speed.
 */
export async function uploadMedia(formData: FormData): Promise<{ 
  success: boolean; 
  url?: string; 
  error?: string;
  format?: string;
  savedPercentage?: number;
}> {
  try {
    await requireUploadPermission();

    const file = (formData.get('file') || formData.get('image')) as File | null;
    if (!file) return { success: false, error: 'لم يتم العثور على أي ملف' };

    const ext = path.extname(file.name).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.ogg', '.heic', '.heif', '.tiff', '.bmp', '.svg'];
    if (!allowedExts.includes(ext)) {
      return { success: false, error: 'صيغة الملف غير مدعومة' };
    }

    const bucket = (formData.get('bucket') as string) || 'uploads';
    const folder = String(formData.get('folder') || '').trim() || undefined;

    // Upload with automated Sharp WebP conversion
    const result = await uploadAndOptimizeFile({
      file,
      filename: file.name,
      bucket,
      folder,
      quality: 80,
      forceWebp: true,
    });

    if (!result.success || !result.url) {
      return { success: false, error: result.error || 'حدث خطأ أثناء معالجة ورفع الصورة' };
    }

    return { 
      success: true, 
      url: result.url,
      format: result.format,
      savedPercentage: result.savedPercentage,
    };
  } catch (error: any) {
    console.error('Upload Error:', error);
    return { success: false, error: error?.message || 'حدث خطأ أثناء الرفع' };
  }
}

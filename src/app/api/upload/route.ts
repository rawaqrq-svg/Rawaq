import { NextResponse } from 'next/server';
import { uploadAndOptimizeFile } from '@/lib/storage/image-service';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Next.js API Route for high-performance image uploads.
 * Automatically converts images (PNG, JPG, HEIC, etc.) to .webp with Sharp (quality: 80)
 * and uploads to Supabase Storage.
 * Optionally links the image to a Product in Supabase PostgreSQL via Prisma.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = (formData.get('image') || formData.get('file')) as File | null;
    const bucket = (formData.get('bucket') as string) || 'product-images';
    const folder = (formData.get('folder') as string) || undefined;
    const productId = (formData.get('productId') as string) || undefined;
    const isMain = formData.get('isMain') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'لم يتم العثور على أي ملف صورة في الطلب' },
        { status: 400 }
      );
    }

    // Process & optimize to WebP and upload
    const result = await uploadAndOptimizeFile({
      file,
      filename: file.name,
      bucket,
      folder,
      quality: 80,
      forceWebp: true,
    });

    if (!result.success || !result.url) {
      return NextResponse.json(
        { success: false, error: result.error || 'فشل رفع ومعالجة الصورة' },
        { status: 500 }
      );
    }

    // Optional: If productId is supplied, attach to the Supabase product record.
    let productImage = null;
    if (productId) {
      try {
        const productExists = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true },
        });

        if (productExists) {
          productImage = await prisma.productImage.create({
            data: {
              productId,
              url: result.url,
              isMain,
              type: isMain ? 'PRIMARY' : 'GALLERY',
              alt: file.name.replace(/\.[^/.]+$/, ''),
            },
          });
        }
      } catch (dbError) {
        console.warn('Could not attach image to product in DB:', dbError);
      }
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      publicUrl: result.url,
      fileName: result.fileName,
      format: result.format || 'webp',
      originalSize: result.originalSize,
      optimizedSize: result.optimizedSize,
      savedPercentage: result.savedPercentage,
      productImage,
    });
  } catch (error: any) {
    console.error('API /api/upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'حدث خطأ داخلي أثناء معالجة الصورة',
      },
      { status: 500 }
    );
  }
}

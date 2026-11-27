import { prisma } from '@/lib/db';
import type { MetadataRoute } from 'next';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://www.rawaq-jo.online';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!BASE_URL) return [];
  const now = new Date();

  // 1. الصفحات الثابتة الأساسية باللغة العربية (الأولوية القصوى)
  const staticPagesAr: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/ar`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/ar/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ar/makeup`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ar/skincare`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ar/accessories`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/ar/offers`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ar/collections`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/ar/collections/new-arrivals`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ar/store-location`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/ar/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/ar/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/ar/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/ar/ingredients`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/ar/shipping`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/ar/returns`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/ar/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/ar/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // 2. الصفحات الثابتة باللغة الإنجليزية
  const staticPagesEn: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/en`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/en/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/makeup`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/skincare`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/accessories`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/en/offers`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/collections`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/en/collections/new-arrivals`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/store-location`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/en/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/en/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/en/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/en/ingredients`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/en/shipping`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/en/returns`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/en/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/en/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // 3. صفحات المنتجات والتصنيفات الديناميكية من قاعدة البيانات
  let productPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];

  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { isVisible: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.category.findMany({
        where: { isVisible: true },
        select: { id: true, slug: true },
      }),
    ]);

    // صفحات المنتجات النشطة
    productPages = products.flatMap((product) => [
      {
        url: `${BASE_URL}/ar/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.85,
      },
      {
        url: `${BASE_URL}/en/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.75,
      },
    ]);

    // صفحات التصنيفات النشطة
    categoryPages = categories.flatMap((cat) => [
      {
        url: `${BASE_URL}/ar/shop?category=${cat.slug || cat.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.75,
      },
      {
        url: `${BASE_URL}/en/shop?category=${cat.slug || cat.id}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.65,
      },
    ]);
  } catch (error) {
    console.error('[Sitemap] Failed to fetch dynamic pages from database:', error);
  }

  return [
    ...staticPagesAr,
    ...staticPagesEn,
    ...productPages,
    ...categoryPages,
  ];
}

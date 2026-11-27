import type { MetadataRoute } from 'next';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://www.rawaq-jo.online';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/ar',
          '/ar/*',
          '/en',
          '/en/*',
          '/brand/*',
          '/favicon.ico',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/api',
          '/api/*',
          '/*/cart',
          '/*/checkout',
          '/*/order-status/*',
          '/*/order-success/*',
          '/*/invoice/*',
          '/*/verify/*',
          '/delivery/*',
          '/supplier-portal/*',
          '/supplier-profile/*',
          '/invoice/*',
          '/*?*token=*',
          '/*?*secret=*',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/ar',
          '/ar/*',
          '/en',
          '/en/*',
          '/brand/*',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/api',
          '/api/*',
          '/*/cart',
          '/*/checkout',
          '/delivery/*',
          '/supplier-portal/*',
        ],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: [
          '/brand/*',
          '/images/*',
          '/uploads/*',
          '*.jpg',
          '*.jpeg',
          '*.png',
          '*.webp',
          '*.svg',
        ],
        disallow: [
          '/admin/*',
          '/private/*',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}

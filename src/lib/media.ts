const ACTIVE_SUPABASE_URL = 'https://mvvsofjitybxjhxorruw.supabase.co';
const LEGACY_SUPABASE_HOST = 'aeukhonneckolcqekxrg.supabase.co';

/** Redirect image references left over from the retired Supabase project. */
export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace(LEGACY_SUPABASE_HOST, 'mvvsofjitybxjhxorruw.supabase.co');
}

/** Legacy CMS values stored as /uploads/<file> point to WebP objects in Supabase Storage. */
export function normalizeSiteUploadUrl(url: string | null | undefined): string {
  if (!url) return '';
  const normalized = normalizeMediaUrl(url);
  const match = normalized.match(/^(?:https?:\/\/rawaq-two\.vercel\.app)?\/uploads\/([^/?#]+)$/i);
  if (!match) return normalized;
  const filename = decodeURIComponent(match[1]);
  const stem = filename.replace(/\.[^.]+$/, '');
  return `${ACTIVE_SUPABASE_URL}/storage/v1/object/public/uploads/site-settings/${encodeURIComponent(stem)}.webp`;
}

export function isRemoteMediaUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

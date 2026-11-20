const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('node:crypto');

const apply = process.argv.includes('--apply');
const source = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const target = createClient(process.env.TARGET_SUPABASE_URL, process.env.TARGET_SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function download(client, bucket, name) {
  const { data, error } = await client.storage.from(bucket).download(name);
  if (error || !data) throw new Error(`Download ${bucket}/${name}: ${error?.message || 'missing data'}`);
  return Buffer.from(await data.arrayBuffer());
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const buckets = await db.query('SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id');
    const objects = await db.query('SELECT bucket_id, name, metadata FROM storage.objects ORDER BY bucket_id, name');
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${buckets.rowCount} buckets, ${objects.rowCount} objects.`);
    if (!apply) {
      const [oldBuckets, newBuckets] = await Promise.all([source.storage.listBuckets(), target.storage.listBuckets()]);
      if (oldBuckets.error || newBuckets.error) throw new Error(`Storage credentials failed: ${oldBuckets.error?.message || newBuckets.error?.message}`);
      console.log(`Storage access verified: source=${oldBuckets.data.length} buckets, target=${newBuckets.data.length} buckets.`);
      return;
    }
    const { data: existing, error: bucketError } = await target.storage.listBuckets();
    if (bucketError) throw new Error(`Target bucket listing: ${bucketError.message}`);
    const existingIds = new Set((existing || []).map(bucket => bucket.id));
    for (const bucket of buckets.rows) {
      if (existingIds.has(bucket.id)) continue;
      const { error } = await target.storage.createBucket(bucket.id, {
        public: bucket.public,
        ...(bucket.file_size_limit ? { fileSizeLimit: Number(bucket.file_size_limit) } : {}),
        ...(bucket.allowed_mime_types?.length ? { allowedMimeTypes: bucket.allowed_mime_types } : {}),
      });
      if (error) throw new Error(`Create bucket ${bucket.id}: ${error.message}`);
      console.log(`Created bucket ${bucket.id}`);
    }
    let copied = 0;
    for (const object of objects.rows) {
      const original = await download(source, object.bucket_id, object.name);
      const contentType = object.metadata?.mimetype || 'application/octet-stream';
      const { error } = await target.storage.from(object.bucket_id).upload(object.name, original, {
        contentType, upsert: true, cacheControl: '31536000',
      });
      if (error) throw new Error(`Upload ${object.bucket_id}/${object.name}: ${error.message}`);
      const uploaded = await download(target, object.bucket_id, object.name);
      if (digest(original) !== digest(uploaded)) throw new Error(`Checksum mismatch: ${object.bucket_id}/${object.name}`);
      copied++;
      if (copied % 25 === 0 || copied === objects.rowCount) console.log(`Verified ${copied}/${objects.rowCount} objects`);
    }
    console.log(`Storage migration complete: ${copied} objects verified.`);
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

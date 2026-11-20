import { Client } from 'pg';

const references = [
  ['ProductImage', 'url'],
  ['ProductVariant', 'mainImage'],
  ['ProductVariant', 'swatchImage'],
  ['ProductVariant', 'modelImage'],
  ['Category', 'imagePath'],
  ['Collection', 'image'],
  ['HomepageHeroSlide', 'imageUrl'],
  ['Brand', 'logoUrl'],
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe identifier: ${value}`);
  return `"${value}"`;
}

async function main() {
  const database = new Client({
    connectionString: requiredEnv('DATABASE_URL'),
    ssl: { rejectUnauthorized: false },
  });
  await database.connect();
  try {
    let total = 0;
    for (const [table, column] of references) {
      const result = await database.query<{ value: string; count: string }>(`
        SELECT ${quoteIdentifier(column)} AS value, count(*)::text AS count
        FROM ${quoteIdentifier(table)}
        WHERE ${quoteIdentifier(column)} LIKE '/images/%'
           OR ${quoteIdentifier(column)} LIKE '/uploads/%'
           OR ${quoteIdentifier(column)} LIKE '/api/media/%'
        GROUP BY ${quoteIdentifier(column)}
        ORDER BY ${quoteIdentifier(column)}
      `);
      const count = result.rows.reduce((sum, row) => sum + Number(row.count), 0);
      total += count;
      console.log(`${table}.${column}: ${count}`);
      for (const row of result.rows) console.log(`  ${row.count} x ${row.value}`);
    }

    const settings = await database.query<{ key: string; value: string }>(
      `SELECT key, value FROM "SiteSettings" ORDER BY key`,
    );
    const localSettings: Array<{ key: string; value: string }> = [];
    const visit = (key: string, value: unknown) => {
      if (typeof value === 'string' && (
        value.startsWith('/images/') || value.startsWith('/uploads/') || value.startsWith('/api/media/')
      )) localSettings.push({ key, value });
      else if (Array.isArray(value)) value.forEach(item => visit(key, item));
      else if (value && typeof value === 'object') Object.values(value).forEach(item => visit(key, item));
    };
    for (const row of settings.rows) {
      try { visit(row.key, JSON.parse(row.value)); } catch { visit(row.key, row.value); }
    }
    total += localSettings.length;
    console.log(`SiteSettings.value: ${localSettings.length}`);
    for (const row of localSettings) console.log(`  ${row.key}: ${row.value}`);

    console.log(`Local media references: ${total}`);
    if (total > 0) process.exitCode = 2;
  } finally {
    await database.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

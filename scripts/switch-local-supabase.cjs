const fs = require('node:fs');
const path = require('node:path');

const currentPath = path.resolve('.env');
const backupPath = path.resolve('.env.previous-supabase.local');
if (!process.env.TARGET_DATABASE_URL || !process.env.TARGET_SUPABASE_SECRET_KEY) throw new Error('Target environment is incomplete');
const current = fs.readFileSync(currentPath, 'utf8');
if (!current.includes('aeukhonneckolcqekxrg')) throw new Error('Current .env is not the expected source project');
if (fs.existsSync(backupPath)) throw new Error('Backup already exists; refusing to overwrite it');

const values = {
  DATABASE_URL: process.env.TARGET_RUNTIME_DATABASE_URL,
  DIRECT_URL: process.env.TARGET_DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.TARGET_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.TARGET_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL: process.env.TARGET_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.TARGET_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.TARGET_SUPABASE_SECRET_KEY,
  SUPABASE_JWKS_URL: `${process.env.TARGET_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  DB_POOL_MAX: '5',
};
const lines = current.split(/\r?\n/).filter(line => !/^SUPABASE_SERVICE_ROLE_KEY=/.test(line));
for (const [key, value] of Object.entries(values)) {
  const replacement = `${key}=${JSON.stringify(value)}`;
  const index = lines.findIndex(line => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = replacement;
  else lines.push(replacement);
}
fs.copyFileSync(currentPath, backupPath, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(currentPath, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
console.log(`Local Supabase configuration switched to ${new URL(process.env.TARGET_SUPABASE_URL).host}; previous .env preserved in ignored backup.`);

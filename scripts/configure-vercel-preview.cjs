const { spawnSync } = require('node:child_process');

const secret = process.env.TARGET_SUPABASE_SECRET_KEY;
const values = {
  DATABASE_URL: process.env.TARGET_RUNTIME_DATABASE_URL,
  DIRECT_URL: process.env.TARGET_DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.TARGET_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.TARGET_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  DB_POOL_MAX: '5',
};

for (const [name, value] of Object.entries(values)) {
  if (process.argv.includes('--only-public') && name !== 'NEXT_PUBLIC_SUPABASE_URL') continue;
  if (!value) throw new Error(`Missing ${name}`);
  const isPublic = name.startsWith('NEXT_PUBLIC_');
  const result = spawnSync('vercel.cmd', ['env', 'add', name, '--environment', 'preview', '--force', '--yes', isPublic ? '--no-sensitive' : '--sensitive'], {
    input: `${value}\n`,
    encoding: 'utf8',
    shell: true,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout || ''} ${result.stderr || ''} ${result.error?.message || ''}`;
    throw new Error(`Vercel rejected ${name}: ${detail.replaceAll(value, '[redacted]').trim()}`);
  }
  console.log(`Configured Preview: ${name}`);
}

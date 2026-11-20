const { spawnSync } = require('node:child_process');

if (!process.env.DATABASE_URL || !process.env.TARGET_DATABASE_URL) throw new Error('Source and target URLs are required');
const args = ['exec', 'tsx', 'scripts/migrate-postgres-to-supabase.ts', ...process.argv.slice(2)];
const result = spawnSync('pnpm.cmd', args, {
  cwd: process.cwd(),
  env: { ...process.env, SOURCE_DATABASE_URL: process.env.DATABASE_URL },
  stdio: 'inherit',
  shell: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

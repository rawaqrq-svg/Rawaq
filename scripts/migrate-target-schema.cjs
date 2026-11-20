const { spawnSync } = require('node:child_process');

if (!process.env.TARGET_DATABASE_URL) throw new Error('TARGET_DATABASE_URL is required');
const prismaArgs = process.argv.includes('--sync')
  ? ['exec', 'prisma', 'db', 'push']
  : ['exec', 'prisma', 'migrate', 'deploy'];
const result = spawnSync('pnpm.cmd', prismaArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: process.env.TARGET_RUNTIME_DATABASE_URL,
    DIRECT_URL: process.env.TARGET_DATABASE_URL,
  },
  stdio: 'inherit',
  shell: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

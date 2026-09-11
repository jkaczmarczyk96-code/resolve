import { spawn } from 'node:child_process';

// Uses .env.local supplied by node --env-file; never a service-role key.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55421' || process.env.SITE_URL !== 'http://127.0.0.1:3000') {
  throw new Error('Live E2E requires the local Supabase stack and SITE_URL=http://127.0.0.1:3000. It must not run against production.');
}
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.live.config.ts'], {
  stdio: 'inherit', env: { ...process.env, RESOLVE_E2E_LIVE: '1' },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });

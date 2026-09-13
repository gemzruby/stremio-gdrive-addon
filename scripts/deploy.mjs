import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const secretNames = [
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
  'ADDON_TOKEN', 'STREAM_SIGNING_SECRET',
];

for (const name of secretNames) {
  if (!process.env[name] || process.env[name].startsWith('REPLACE_WITH_')) {
    console.error(`Set ${name} in .dev.vars before deploying.`);
    process.exit(1);
  }
}

const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
if (!config.vars?.PUBLIC_BASE_URL?.startsWith('https://') || config.vars.PUBLIC_BASE_URL.includes('REPLACE_WITH_')) {
  console.error('Set the production HTTPS PUBLIC_BASE_URL in wrangler.jsonc before deploying.');
  process.exit(1);
}

const directory = await mkdtemp(join(tmpdir(), 'drivemio-secrets-'));
const secretsFile = join(directory, 'secrets.env');
try {
  await writeFile(secretsFile, `${secretNames.map(name => `${name}=${JSON.stringify(process.env[name])}`).join('\n')}\n`, { mode: 0o600 });
  const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, 'deploy', '--secrets-file', secretsFile], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  if (status !== 0) process.exitCode = status;
} finally {
  await rm(directory, { recursive: true, force: true });
}

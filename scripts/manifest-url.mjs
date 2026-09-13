import { readFile } from 'node:fs/promises';
const token = process.env.ADDON_TOKEN;
if (!token || token.startsWith('REPLACE_WITH_')) throw new Error('Set ADDON_TOKEN in .dev.vars first');
const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const origin = new URL(config.vars.PUBLIC_BASE_URL).origin;
if (!origin.startsWith('https://')) throw new Error('Production PUBLIC_BASE_URL must use HTTPS');
console.log(`${origin}/${encodeURIComponent(token)}/manifest.json`);

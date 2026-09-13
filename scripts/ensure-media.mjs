import { access, copyFile } from 'node:fs/promises';
const target = new URL('../src/data/media.json', import.meta.url);
try { await access(target); }
catch { await copyFile(new URL('../src/data/media.example.json', import.meta.url), target); }

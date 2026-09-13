import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MEDIA_PATH = new URL('../src/data/media.json', import.meta.url);
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function toMediaItem(file, previous = {}) {
  if (!file?.id || !file?.name || !file?.mimeType?.startsWith('video/')) throw new Error('Invalid Drive video metadata');
  const name = file.name.replace(/\.[^.]+$/, '').trim() || file.name;
  const year = /^\d{4}/.exec(file.createdTime ?? '')?.[0] ?? 'Unknown';
  return {
    id: `tam_${file.id}`,
    type: 'movie',
    name,
    description: file.description?.trim() || `Video from Google Drive: ${name}.`,
    ...(previous.poster ? { poster: previous.poster } : {}),
    ...(previous.background ? { background: previous.background } : {}),
    releaseInfo: year,
    driveFileId: file.id,
    mimeType: file.mimeType,
  };
}

export async function listVideos(folderId, accessToken, fetcher = fetch, recursive = false) {
  if (!/^[A-Za-z0-9_-]+$/.test(folderId)) throw new Error('Invalid Drive folder ID');
  const folders = [folderId];
  const visited = new Set();
  const videos = [];
  while (folders.length) {
    const parent = folders.shift();
    if (visited.has(parent)) continue;
    visited.add(parent);
    let pageToken;
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `'${parent}' in parents and trashed = false`);
      url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,description,createdTime)');
      url.searchParams.set('pageSize', '1000');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await fetcher(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Drive listing failed (HTTP ${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.files)) throw new Error('Invalid Drive listing response');
      for (const file of data.files) {
        if (file.mimeType?.startsWith('video/')) videos.push(file);
        else if (recursive && file.mimeType === FOLDER_MIME && /^[A-Za-z0-9_-]+$/.test(file.id)) folders.push(file.id);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  return videos;
}

export async function getAccessToken(env, fetcher = fetch) {
  for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']) {
    if (!env[name] || env[name].startsWith('REPLACE_WITH_')) throw new Error(`Set ${name} in .dev.vars first`);
  }
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) throw new Error(`Google OAuth failed (HTTP ${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error('Google OAuth returned no access token');
  return data.access_token;
}

export async function syncMedia(folderId, { recursive = false, dryRun = false, fetcher = fetch, env = process.env, mediaPath = MEDIA_PATH } = {}) {
  const token = await getAccessToken(env, fetcher);
  const videos = await listVideos(folderId, token, fetcher, recursive);
  if (!videos.length) throw new Error('No video files found; media.json was not changed');
  const existing = JSON.parse(await readFile(mediaPath, 'utf8'));
  if (!Array.isArray(existing)) throw new Error('media.json must be an array');
  const previousByFile = new Map(existing.map(item => [item.driveFileId, item]));
  const items = videos.map(file => toMediaItem(file, previousByFile.get(file.id)));
  items.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (new Set(items.map(item => item.driveFileId)).size !== items.length) throw new Error('Drive returned duplicate file IDs');
  if (!dryRun) await writeFile(mediaPath, `${JSON.stringify(items, null, 2)}\n`);
  return items.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const positional = args.filter(arg => !arg.startsWith('--'));
  const folderId = positional[0] ?? process.env.DRIVE_FOLDER_ID;
  if (!folderId || folderId.startsWith('REPLACE_WITH_') || positional.length > 1 || args.some(arg => arg !== folderId && !['--recursive', '--dry-run'].includes(arg))) {
    console.error('Usage: npm run sync:media -- [DRIVE_FOLDER_ID] [--recursive] [--dry-run] (or set DRIVE_FOLDER_ID in .dev.vars)');
    process.exitCode = 1;
  } else {
    try {
      const count = await syncMedia(folderId, { recursive: args.includes('--recursive'), dryRun: args.includes('--dry-run') });
      console.log(`${count} video(s) ${args.includes('--dry-run') ? 'found; no file changed' : 'written to src/data/media.json'}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Media sync failed');
      process.exitCode = 1;
    }
  }
}

import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listVideos, syncMedia, toMediaItem } from '../scripts/sync-media.mjs';

const env = { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_REFRESH_TOKEN: 'refresh' };
const video = { id: 'file123', name: 'Trip.mp4', mimeType: 'video/mp4', createdTime: '2026-01-02T00:00:00Z' };

describe('Drive media sync', () => {
  it('creates stable IDs and preserves manually supplied artwork', () => {
    expect(toMediaItem(video, { poster: 'https://images.example/poster.jpg' })).toMatchObject({ id: 'tam_file123', name: 'Trip', releaseInfo: '2026', poster: 'https://images.example/poster.jpg' });
    expect(toMediaItem(video)).not.toHaveProperty('poster');
  });
  it('handles pagination and optional subfolders', async () => {
    const fetcher = vi.fn(async url => {
      const page = url.searchParams.get('pageToken');
      const q = url.searchParams.get('q');
      if (q.includes('root') && !page) return Response.json({ files: [{ id: 'sub', mimeType: 'application/vnd.google-apps.folder' }, video], nextPageToken: 'next' });
      if (q.includes('root')) return Response.json({ files: [{ id: 'ignored', mimeType: 'image/jpeg' }] });
      return Response.json({ files: [{ id: 'file456', name: 'Second.mkv', mimeType: 'video/x-matroska' }] });
    });
    expect((await listVideos('root', 'access', fetcher, true)).map(file => file.id)).toEqual(['file123', 'file456']);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('writes a deterministic catalog and never clears it after an empty scan', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'drivemio-test-'));
    const mediaPath = join(folder, 'media.json');
    await writeFile(mediaPath, JSON.stringify([{ driveFileId: 'file123', poster: 'https://images.example/p.jpg' }]));
    try {
      const fetcher = vi.fn(async url => String(url).includes('oauth2.googleapis.com') ? Response.json({ access_token: 'access' }) : Response.json({ files: [video] }));
      expect(await syncMedia('root', { env, fetcher, mediaPath })).toBe(1);
      const written = JSON.parse(await readFile(mediaPath, 'utf8'));
      expect(written[0]).toMatchObject({ id: 'tam_file123', poster: 'https://images.example/p.jpg' });
      const emptyFetcher = vi.fn(async url => String(url).includes('oauth2.googleapis.com') ? Response.json({ access_token: 'access' }) : Response.json({ files: [] }));
      await expect(syncMedia('root', { env, fetcher: emptyFetcher, mediaPath })).rejects.toThrow(/No video/);
      expect(JSON.parse(await readFile(mediaPath, 'utf8'))).toEqual(written);
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});

import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/index';
import { env } from './fixtures';
import { media, validateMedia } from '../src/domain/media';
import { verifyVideo } from '../src/services/stream-signer';
const call = (path: string) => handleRequest(new Request(`https://addon.example${path}`), env);
const body = async (path: string): Promise<{ resources: string[]; metas: Record<string, unknown>[]; meta: { name: string } | null; streams: { url: string }[] }> => JSON.parse(await (await call(path)).text());
describe('addon', () => {
  it('serves manifest and hides routes behind token', async () => {
    expect((await body('/private-token/manifest.json')).resources).toEqual(['catalog', 'meta', 'stream']);
    expect((await call('/wrong/manifest.json')).status).toBe(404);
  });
  it('serves catalog and meta without Drive ID', async () => {
    const catalog = await body('/private-token/catalog/movie/my-drive.json');
    expect(catalog.metas).toHaveLength(media.length);
    expect(JSON.stringify(catalog)).not.toContain('driveFileId');
    expect((await body(`/private-token/meta/movie/${media[0].id}.json`)).meta?.name).toBe(media[0].name);
    expect((await body('/private-token/meta/movie/unknown.json')).meta).toBeNull();
  });
  it('creates signed stream for known media only', async () => {
    const response = await body(`/private-token/stream/movie/${media[0].id}.json`);
    const signedUrl = new URL(response.streams[0].url);
    expect(signedUrl.origin).toBe('https://addon.example');
    expect(signedUrl.pathname).toBe(`/video/${encodeURIComponent(media[0].driveFileId)}`);
    expect(await verifyVideo(env.STREAM_SIGNING_SECRET, media[0].driveFileId, signedUrl.searchParams.get('exp'), signedUrl.searchParams.get('sig'))).toBe(true);
    expect((await body('/private-token/stream/movie/nope.json')).streams).toEqual([]);
  });
});
describe('media validation', () => {
  const item = { id: 'tam_one', type: 'movie', name: 'One', description: 'Test', poster: 'https://example.com/a.jpg', background: 'https://example.com/b.jpg', releaseInfo: '2026', driveFileId: 'file1', mimeType: 'video/mp4' };
  it('rejects duplicates and invalid URLs', () => {
    expect(() => validateMedia([item, item])).toThrow(/Duplicate/);
    expect(() => validateMedia([item, { ...item, id: 'tam_two' }])).toThrow(/Duplicate/);
    expect(() => validateMedia([{ ...item, poster: 'bad' }])).toThrow(/Invalid poster/);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/index';
import { signVideo } from '../src/services/stream-signer';
import { env } from './fixtures';
import { media } from '../src/domain/media';
const file = media[0].driveFileId;
async function url(fileId = file) { const exp = Math.floor(Date.now() / 1000) + 100; return `https://addon.example/video/${fileId}?exp=${exp}&sig=${await signVideo(env.STREAM_SIGNING_SECRET, fileId, exp)}`; }
function mockFetcher(status = 206) {
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    if (String(input).includes('oauth2.googleapis.com')) return Response.json({ access_token: 'access', expires_in: 3600 });
    return new Response(status === 416 ? null : 'abc', { status, headers: status === 206 ? { 'Content-Range': 'bytes 100-102/1000', 'Content-Length': '3', 'Content-Type': 'video/mp4' } : {} });
  });
  return fetcher;
}
describe('video proxy', () => {
  it('rejects missing signature and unknown file before Google', async () => {
    const fetcher = mockFetcher();
    expect((await handleRequest(new Request('https://addon.example/video/file'), env, fetcher)).status).toBe(403);
    expect((await handleRequest(new Request(await url('other')), env, fetcher)).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards range, status, headers and streamed body', async () => {
    const fetcher = mockFetcher();
    const response = await handleRequest(new Request(await url(), { headers: { Range: 'bytes=100-199' } }), env, fetcher);
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 100-102/1000');
    expect(response.headers.get('Content-Length')).toBe('3');
    expect(response.body).toBeInstanceOf(ReadableStream);
    expect(await response.text()).toBe('abc');
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Range: 'bytes=100-199' });
  });
  it('preserves 416 and handles HEAD without a body', async () => {
    expect((await handleRequest(new Request(await url()), env, mockFetcher(416))).status).toBe(416);
    const fetcher = mockFetcher();
    const head = await handleRequest(new Request(await url(), { method: 'HEAD' }), env, fetcher);
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Range: 'bytes=0-0' });
  });
  it('refreshes and retries a Drive 401 only once', async () => {
    let driveCalls = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('oauth2.googleapis.com')) return Response.json({ access_token: 'access', expires_in: 3600 });
      driveCalls++;
      return new Response(null, { status: 401 });
    });
    const response = await handleRequest(new Request(await url()), env, fetcher);
    expect(response.status).toBe(502);
    expect(driveCalls).toBe(2);
    expect(await response.text()).not.toContain(env.GOOGLE_CLIENT_SECRET);
  });
});

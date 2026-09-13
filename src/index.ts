import { media, publicMeta } from './domain/media';
import { baseUrl, ttl, type Env } from './env';
import { GoogleTokenProvider } from './services/google-token-provider';
import { GoogleDriveClient } from './services/google-drive-client';
import { signVideo, verifyVideo } from './services/stream-signer';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Range, Content-Type', 'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges' };
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } }); }
function error(status: number, code: string): Response { return json({ error: { code } }, status); }
function pathPart(value: string): string | null { try { return decodeURIComponent(value); } catch { return null; } }
function sameToken(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a), bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
const manifest = { id: 'com.tam.private-drive', version: '1.0.1', name: 'drivemio', description: 'Private Google Drive video library', resources: ['catalog', 'meta', 'stream'], types: ['movie'], catalogs: [{ type: 'movie', id: 'my-drive', name: 'My Drive' }], idPrefixes: ['tam_'] };
const mediaHeaders = ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified', 'Content-Disposition'];
const homePage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DriveMio</title>
  <style>
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #0f172a; color: #f8fafc; font: 16px/1.6 system-ui, sans-serif; }
    main { max-width: 34rem; padding: 2rem; text-align: center; }
    h1 { margin: 0 0 .5rem; font-size: clamp(2rem, 6vw, 3.5rem); letter-spacing: -.04em; }
    p { margin: 0; color: #cbd5e1; }
  </style>
</head>
<body><main><h1>Powered by DriveMio</h1><p>Private Google Drive streaming for Stremio-compatible apps.</p></main></body>
</html>`;

export async function handleRequest(request: Request, env: Env, fetcher: typeof fetch = fetch.bind(globalThis)): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'HEAD'].includes(request.method)) return error(405, 'METHOD_NOT_ALLOWED');
    if (url.pathname === '/') return new Response(request.method === 'HEAD' ? null : homePage, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    const videoMatch = /^\/video\/([^/]+)$/.exec(url.pathname);
    if (videoMatch) {
      const fileId = pathPart(videoMatch[1]);
      if (!fileId || !await verifyVideo(env.STREAM_SIGNING_SECRET, fileId, url.searchParams.get('exp'), url.searchParams.get('sig'))) return error(403, 'INVALID_SIGNATURE');
      if (!media.some(item => item.driveFileId === fileId)) return error(404, 'NOT_FOUND');
      const range = request.headers.get('Range');
      if (range && !/^bytes=\d+-\d*$/.test(range)) return error(416, 'INVALID_RANGE');
      // Drive's media endpoint is GET-oriented. For HEAD, request one byte, then cancel the body.
      const upstreamRange = request.method === 'HEAD' ? 'bytes=0-0' : range ?? undefined;
      const upstream = await new GoogleDriveClient(new GoogleTokenProvider(env, fetcher), fetcher).get(fileId, upstreamRange, request.signal);
      if (![200, 206, 416].includes(upstream.status)) {
        await upstream.body?.cancel();
        return error(upstream.status === 404 || upstream.status === 403 ? 404 : 502, 'DRIVE_UNAVAILABLE');
      }
      const headers = new Headers(cors);
      for (const name of mediaHeaders) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
      headers.set('Accept-Ranges', 'bytes'); headers.set('Cache-Control', 'private, no-store');
      if (upstream.status === 416) {
        await upstream.body?.cancel();
        return new Response(null, { status: 416, headers });
      }
      if (request.method === 'HEAD') {
        await upstream.body?.cancel();
        if (upstream.status === 206) {
          const total = /\/([0-9]+)$/.exec(upstream.headers.get('Content-Range') ?? '')?.[1];
          if (total) headers.set('Content-Length', total); else headers.delete('Content-Length');
          headers.delete('Content-Range');
          return new Response(null, { status: 200, headers });
        }
        return new Response(null, { status: upstream.status, headers });
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || !sameToken(parts[0], env.ADDON_TOKEN)) return error(404, 'NOT_FOUND');
    const route = parts.slice(1).join('/');
    if (route === 'manifest.json') return json(manifest);
    if (route === 'catalog/movie/my-drive.json') return json({ metas: media.map(publicMeta) });
    const metaMatch = /^meta\/movie\/([^/]+)\.json$/.exec(route);
    if (metaMatch) return json({ meta: media.find(item => item.id === pathPart(metaMatch[1])) ? publicMeta(media.find(item => item.id === pathPart(metaMatch[1]))!) : null });
    const streamMatch = /^stream\/movie\/([^/]+)\.json$/.exec(route);
    if (streamMatch) {
      const item = media.find(entry => entry.id === pathPart(streamMatch[1]));
      if (!item) return json({ streams: [] });
      const exp = Math.floor(Date.now() / 1000) + ttl(env);
      const signedUrl = new URL(`/video/${encodeURIComponent(item.driveFileId)}`, baseUrl(env));
      signedUrl.searchParams.set('exp', String(exp));
      signedUrl.searchParams.set('sig', await signVideo(env.STREAM_SIGNING_SECRET, item.driveFileId, exp));
      return json({ streams: [{ name: 'Google Drive', title: 'Original', url: signedUrl.toString() }] });
    }
    return error(404, 'NOT_FOUND');
  } catch (cause) {
    const safeCodes = ['GOOGLE_AUTH_FAILED', 'GOOGLE_AUTH_NETWORK_FAILED', 'GOOGLE_DRIVE_NETWORK_FAILED'];
    const code = cause instanceof Error && safeCodes.includes(cause.message) ? cause.message : 'UPSTREAM_OR_CONFIG_ERROR';
    return error(502, code);
  }
}
export default { fetch(request: Request, env: Env) { return handleRequest(request, env); } } satisfies ExportedHandler<Env>;

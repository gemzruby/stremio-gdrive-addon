export interface Env {
  GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; GOOGLE_REFRESH_TOKEN: string;
  ADDON_TOKEN: string; STREAM_SIGNING_SECRET: string;
  PUBLIC_BASE_URL: string; STREAM_URL_TTL_SECONDS?: string;
}
export function baseUrl(env: Env): string {
  const url = new URL(env.PUBLIC_BASE_URL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid PUBLIC_BASE_URL');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('PUBLIC_BASE_URL must use HTTPS');
  return url.origin;
}
export function ttl(env: Env): number {
  const value = Number(env.STREAM_URL_TTL_SECONDS ?? '3600');
  if (!Number.isSafeInteger(value) || value < 1 || value > 86400) throw new Error('Invalid STREAM_URL_TTL_SECONDS');
  return value;
}

import type { Env } from '../src/env';

export const env: Env = {
  GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_REFRESH_TOKEN: 'refresh',
  ADDON_TOKEN: 'private-token', STREAM_SIGNING_SECRET: 'signing-secret',
  PUBLIC_BASE_URL: 'https://addon.example', STREAM_URL_TTL_SECONDS: '3600',
};

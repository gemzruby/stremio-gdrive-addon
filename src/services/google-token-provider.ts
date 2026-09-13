import type { Env } from '../env';
export class GoogleTokenProvider {
  private cached?: { token: string; expiresAt: number };
  constructor(private env: Env, private fetcher: typeof fetch = fetch.bind(globalThis)) {}
  async get(force = false): Promise<string> {
    if (!force && this.cached && this.cached.expiresAt > Date.now() + 60_000) return this.cached.token;
    const body = new URLSearchParams({ client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET, refresh_token: this.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' });
    let response: Response;
    try {
      response = await this.fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    } catch {
      throw new Error('GOOGLE_AUTH_NETWORK_FAILED');
    }
    if (!response.ok) throw new Error('GOOGLE_AUTH_FAILED');
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in) throw new Error('GOOGLE_AUTH_FAILED');
    this.cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }
}

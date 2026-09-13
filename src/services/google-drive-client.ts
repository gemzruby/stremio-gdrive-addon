import { GoogleTokenProvider } from './google-token-provider';
export class GoogleDriveClient {
  constructor(private tokens: GoogleTokenProvider, private fetcher: typeof fetch = fetch.bind(globalThis)) {}
  async get(fileId: string, range?: string, signal?: AbortSignal): Promise<Response> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    let token = await this.tokens.get();
    const request = async () => {
      try { return await this.fetcher(url, { headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) }, signal }); }
      catch { throw new Error('GOOGLE_DRIVE_NETWORK_FAILED'); }
    };
    let response = await request();
    if (response.status === 401) {
      await response.body?.cancel();
      token = await this.tokens.get(true);
      response = await request();
    }
    return response;
  }
}

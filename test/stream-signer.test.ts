import { describe, expect, it } from 'vitest';
import { signVideo, verifyVideo } from '../src/services/stream-signer';
describe('video signatures', () => {
  it('binds file and expiry, and expires exactly at exp', async () => {
    const sig = await signVideo('secret', 'file1', 1000);
    expect(await verifyVideo('secret', 'file1', '1000', sig, 999)).toBe(true);
    expect(await verifyVideo('secret', 'file2', '1000', sig, 999)).toBe(false);
    expect(await verifyVideo('secret', 'file1', '1000', '0' + sig.slice(1), 999)).toBe(false);
    expect(await verifyVideo('secret', 'file1', '1000', sig, 1000)).toBe(false);
  });
});

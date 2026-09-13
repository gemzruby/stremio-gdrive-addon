const encoder = new TextEncoder();
function hex(bytes: Uint8Array): string { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
async function signature(secret: string, fileId: string, exp: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${fileId}:${exp}`))));
}
export async function signVideo(secret: string, fileId: string, exp: number): Promise<string> { return signature(secret, fileId, exp); }
export async function verifyVideo(secret: string, fileId: string, expText: string | null, sig: string | null, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!expText || !/^[0-9]+$/.test(expText) || !sig || !/^[a-f0-9]{64}$/.test(sig)) return false;
  const exp = Number(expText);
  if (!Number.isSafeInteger(exp) || exp <= now) return false;
  const expected = await signature(secret, fileId, exp);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Checks Discord's Ed25519 signature over `timestamp + body` (headers X-Signature-Ed25519 and
 * X-Signature-Timestamp). Malformed input returns false, never throws.
 */
export async function verifyDiscordRequest(
  publicKey: string,
  signature: string | null,
  timestamp: string | null,
  body: string,
): Promise<boolean> {
  const key = hexToBytes(publicKey);
  const sig = signature ? hexToBytes(signature) : null;
  if (!key || key.length !== 32 || !sig || sig.length !== 64 || !timestamp) return false;
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', cryptoKey, sig, new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

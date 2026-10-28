/**
 * Edge-compatible and Node-compatible session token generator and verifier using Web Crypto API.
 */

export const AUTH_COOKIE_NAME = 'trendpulse_session';
export const DEFAULT_AUTH_SECRET = process.env.AUTH_SECRET || 'trendpulse-vps-secure-auth-secret-key-2026';

export interface TokenPayload {
  u: string;   // username
  exp: number; // expiration timestamp (ms)
  iat: number; // issued at timestamp (ms)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Creates a signed JWT-like token: base64url(payload).base64url(signature)
 */
export async function createSessionToken(
  username: string,
  maxAgeSeconds = 7 * 86400,
  secret = DEFAULT_AUTH_SECRET
): Promise<string> {
  const now = Date.now();
  const payload: TokenPayload = {
    u: username,
    iat: now,
    exp: now + maxAgeSeconds * 1000,
  };

  const enc = new TextEncoder();
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = enc.encode(payloadJson);
  const payloadBase64 = bytesToBase64Url(payloadBytes);

  const key = await getHmacKey(secret);
  const dataToSign = enc.encode(payloadBase64);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, dataToSign);
  const sigBase64 = bytesToBase64Url(new Uint8Array(sigBuffer));

  return `${payloadBase64}.${sigBase64}`;
}

/**
 * Verifies signed session token and checks expiration.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret = DEFAULT_AUTH_SECRET
): Promise<{ valid: boolean; username?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadBase64, sigBase64] = parts;
  if (!payloadBase64 || !sigBase64) {
    return { valid: false };
  }

  try {
    const key = await getHmacKey(secret);
    const enc = new TextEncoder();
    const dataToVerify = enc.encode(payloadBase64);
    const sigBytes = base64UrlToBytes(sigBase64);

    const isValidSig = await crypto.subtle.verify('HMAC', key, sigBytes as any, dataToVerify);
    if (!isValidSig) {
      return { valid: false };
    }

    const payloadBytes = base64UrlToBytes(payloadBase64);
    const dec = new TextDecoder();
    const payloadStr = dec.decode(payloadBytes);
    const payload: TokenPayload = JSON.parse(payloadStr);

    if (Date.now() > payload.exp) {
      return { valid: false };
    }

    return { valid: true, username: payload.u };
  } catch (err) {
    return { valid: false };
  }
}

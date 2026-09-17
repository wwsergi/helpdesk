export const COOKIE_NAME = 'claud-ia-auth';
const AUTH_MESSAGE = 'claud-ia:auth:v1';

// Uses Web Crypto (works in both Edge middleware and Node.js 18+)

export async function createAuthToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(AUTH_MESSAGE));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyAuthToken(secret: string, token: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const tokenBytes = Uint8Array.from(atob(token), (c) => c.charCodeAt(0));
    return crypto.subtle.verify('HMAC', key, tokenBytes, new TextEncoder().encode(AUTH_MESSAGE));
  } catch {
    return false;
  }
}

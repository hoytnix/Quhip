import { Env } from '../types';

export interface OwnerRecord {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: string;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derived))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRandomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function authenticateToken(
  db: D1Database,
  token: string | null | undefined
): Promise<string | null> {
  if (!token) return null;
  const now = Date.now();
  const session = await db.prepare(
    `SELECT owner_id, expires_at FROM auth_sessions WHERE token = ? AND expires_at > ?`
  ).bind(token, now).first<{ owner_id: string; expires_at: number }>();

  return session?.owner_id ?? null;
}

import { Hono } from 'hono';
import { Env } from '../types';
import { hashPassword, generateRandomToken, authenticateToken } from '../services/auth';

export const authRouter = new Hono<{ Bindings: Env }>();

// Initial setup or status check
authRouter.get('/api/auth/status', async (c) => {
  try {
    const countRes = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM owners`).first<{ count: number }>();
    const hasOwner = (countRes?.count ?? 0) > 0;
    return c.json({ hasOwner });
  } catch (err: any) {
    return c.json({ hasOwner: false, error: err?.message || 'Database error' }, 500);
  }
});

// Setup initial owner account (only allowed if zero owners exist)
authRouter.post('/api/auth/setup', async (c) => {
  const countRes = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM owners`).first<{ count: number }>();
  if ((countRes?.count ?? 0) > 0) {
    return c.json({ error: 'Owner account is already configured' }, 400);
  }

  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password || password.length < 8) {
    return c.json({ error: 'Username and password (min 8 chars) required' }, 400);
  }

  const id = crypto.randomUUID();
  const salt = generateRandomToken().slice(0, 16);
  const passwordHash = await hashPassword(password, salt);
  const nowIso = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO owners (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, username, passwordHash, salt, nowIso).run();

  // Create session token
  const token = generateRandomToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (token, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(token, id, Date.now(), expiresAt).run();

  return c.json({ ok: true, token, owner: { id, username } });
});

// Login
authRouter.post('/api/auth/login', async (c) => {
  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const username = body.username?.trim();
  const password = body.password;
  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const owner = await c.env.DB.prepare(
    `SELECT id, username, password_hash, salt FROM owners WHERE username = ?`
  ).bind(username).first<any>();

  if (!owner) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const computedHash = await hashPassword(password, owner.salt);
  if (computedHash !== owner.password_hash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = generateRandomToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (token, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(token, owner.id, Date.now(), expiresAt).run();

  return c.json({ ok: true, token, owner: { id: owner.id, username: owner.username } });
});

// Logout
authRouter.post('/api/auth/logout', async (c) => {
  const authHeader = c.req.header('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (token) {
    await c.env.DB.prepare(`DELETE FROM auth_sessions WHERE token = ?`).bind(token).run();
  }
  return c.json({ ok: true });
});

// Get current owner
authRouter.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const ownerId = await authenticateToken(c.env.DB, token);
  if (!ownerId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const owner = await c.env.DB.prepare(
    `SELECT id, username, created_at FROM owners WHERE id = ?`
  ).bind(ownerId).first<any>();

  return c.json({ ok: true, owner });
});

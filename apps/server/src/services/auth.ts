import type { Context, Next } from 'hono';
import { verifyToken } from './token.js';

/**
 * Authentication middleware
 * Validates the Authorization header token
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({ success: false, error: 'Authorization header required' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return c.json({ success: false, error: 'Token required' }, 401);
  }

  if (!verifyToken(token)) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }

  await next();
}

/**
 * Optional auth middleware - continues even if no token provided
 * Use this when you need to know if user is authenticated but don't require it
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    if (token && verifyToken(token)) {
      c.set('authenticated', true);
      c.set('authToken', token);
    } else {
      c.set('authenticated', false);
    }
  }

  await next();
}
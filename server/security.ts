import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const SECRET_FILE = path.resolve(process.cwd(), 'data', '.server_secret');

function loadOrCreateSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(48).toString('hex');
  }
}

const SERVER_SECRET = loadOrCreateSecret();

/**
 * Generate a 256-bit CSPRNG personal access token.
 * Raw token is returned once to the survey participant and never stored in plaintext.
 */
export function generateAccessToken(): string {
  return `mes_tk_${crypto.randomBytes(32).toString('base64url')}`;
}

/**
 * Generate a 256-bit CSPRNG session token for admin HttpOnly cookies.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Generate a non-sequential, unpredictable survey response code.
 */
export function generateResponseCode(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MES-${yy}${mm}-${rand}`;
}

/**
 * Hash a high-entropy token using keyed HMAC-SHA256.
 */
export function hashAccessToken(rawToken: string): string {
  return crypto.createHmac('sha256', SERVER_SECRET).update(rawToken).digest('hex');
}

/**
 * Constant-time token hash verification to prevent timing attacks.
 */
export function verifyTokenHash(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const computed = Buffer.from(hashAccessToken(rawToken), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

/**
 * Hash admin passwords using memory-hard scrypt with per-user 16-byte CSPRNG salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    const derived = crypto.scryptSync(password, salt, expected.length, { N, r, p });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * HMAC-sign a structured cookie payload (used for verified /my-survey lookup sessions).
 */
export function signCookiePayload(payloadObj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySignedCookiePayload<T extends Record<string, unknown>>(cookieVal?: string): T | null {
  if (!cookieVal) return null;
  const dot = cookieVal.indexOf('.');
  if (dot <= 0) return null;
  const payload = cookieVal.slice(0, dot);
  const sig = cookieVal.slice(dot + 1);
  const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function appendSetCookie(
  res: Response,
  name: string,
  value: string,
  options: { maxAgeSeconds?: number; httpOnly?: boolean; sameSite?: 'Strict' | 'Lax' | 'None'; path?: string } = {}
) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (isProd) parts.push('Secure');
  if (typeof options.maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  const existing = res.getHeader('Set-Cookie');
  const cookieStr = parts.join('; ');
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

export function clearCookie(res: Response, name: string) {
  appendSetCookie(res, name, '', { maxAgeSeconds: 0 });
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // In production enforce HSTS if behind TLS
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const appUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '';
  const allowedOrigins = new Set(
    [appUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean)
  );

  if (origin && (allowedOrigins.has(origin) || origin.endsWith('.run.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Survey-Access-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

export function createRateLimiter(opts: {
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.keyFn ? opts.keyFn(req) : getClientIp(req);
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const prev = hits.get(key) || [];
    const recent = prev.filter((ts) => ts > cutoff);

    if (recent.length >= opts.maxRequests) {
      const retryAfterSec = Math.ceil((recent[0] + opts.windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      res.status(429).json({
        error: opts.message || 'Too many requests. Please try again later.',
      });
      return;
    }

    recent.push(now);
    hits.set(key, recent);

    // Occasional cleanup to prevent unbounded growth
    if (hits.size > 5000) {
      for (const [k, list] of hits.entries()) {
        const filtered = list.filter((ts) => ts > cutoff);
        if (filtered.length === 0) hits.delete(k);
        else hits.set(k, filtered);
      }
    }
    next();
  };
}

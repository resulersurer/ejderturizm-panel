import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'ejder_panel_session';
const SIGNING_VALUE = 'ejder-panel-session-v1';

function adminKey(): string | undefined {
  return process.env['PANEL_ADMIN_KEY'];
}

function digest(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash('sha256').update(value).digest());
}

function signature(secret: string): string {
  return createHmac('sha256', secret).update(SIGNING_VALUE).digest('base64url');
}

function cookieValue(req: VercelRequest): string | undefined {
  const cookies = req.headers.cookie?.split(';') ?? [];
  return cookies
    .map((cookie) => cookie.trim().split('='))
    .find(([name]) => name === COOKIE_NAME)?.[1];
}

export function isAuthConfigured(): boolean {
  return Boolean(adminKey());
}

export function isPasswordValid(password: unknown): boolean {
  const secret = adminKey();
  return Boolean(secret && typeof password === 'string' && timingSafeEqual(digest(password), digest(secret)));
}

export function isAuthenticated(req: VercelRequest): boolean {
  const secret = adminKey();
  const candidate = cookieValue(req);
  return Boolean(secret && candidate && timingSafeEqual(digest(candidate), digest(signature(secret))));
}

export function requireAuthentication(req: VercelRequest, res: VercelResponse): boolean {
  if (isAuthenticated(req)) {
    return true;
  }

  res.status(401).json({ code: 'UNAUTHORIZED', message: 'Oturum acmaniz gerekiyor.' });
  return false;
}

export function setSessionCookie(res: VercelResponse): void {
  const secret = adminKey();
  if (!secret) {
    throw new Error('AUTH_NOT_CONFIGURED');
  }

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${signature(secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

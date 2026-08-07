import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearSessionCookie,
  isAuthConfigured,
  isAuthenticated,
  isPasswordValid,
  setSessionCookie,
} from './_auth.js';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    res.status(200).json({
      authenticated: isAuthenticated(req),
      configured: isAuthConfigured(),
    });
    return;
  }

  if (req.method === 'POST') {
    if (!isAuthConfigured()) {
      res.status(503).json({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'PANEL_ADMIN_KEY Vercel ortam degiskeni tanimli degil.',
      });
      return;
    }

    if (!isPasswordValid(req.body?.password)) {
      res.status(401).json({ code: 'INVALID_PASSWORD', message: 'Yonetici parolasi hatali.' });
      return;
    }

    setSessionCookie(res);
    res.status(200).json({ authenticated: true, configured: true });
    return;
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    res.status(204).end();
    return;
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
}

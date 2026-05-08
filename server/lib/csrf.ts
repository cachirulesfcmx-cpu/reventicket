import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf_token';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export function csrfTokenEndpoint(req: Request, res: Response) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  res.json({ token: req.session.csrfToken });
}

export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  // Skip for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip for API health check and CSRF token endpoint
  if (req.path === '/api/health' || req.path === '/api/csrf') {
    return next();
  }

  // Skip for auth endpoints (login/register need to work before CSRF is established)
  const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];
  if (authEndpoints.includes(req.path)) {
    return next();
  }

  // Get token from header
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const sessionToken = req.session?.csrfToken;

  // If no session token exists, reject (user must fetch CSRF token first via GET /api/csrf)
  if (!sessionToken) {
    return res.status(403).json({ 
      error: 'Sesión CSRF no inicializada. Obtén un token primero.',
      code: 'CSRF_NO_SESSION'
    });
  }

  // Validate token
  if (!headerToken || headerToken !== sessionToken) {
    return res.status(403).json({ 
      error: 'Token CSRF inválido',
      code: 'CSRF_INVALID'
    });
  }

  next();
}

export function csrfMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Ensure session has CSRF token
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCSRFToken();
    }
    next();
  };
}

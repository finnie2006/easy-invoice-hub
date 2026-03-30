import jwt from 'jsonwebtoken';
import pool from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const ACCESS_COOKIE_NAME = 'invoice_hub_access';
const REFRESH_COOKIE_NAME = 'invoice_hub_refresh';

function parseCookies(req) {
  const raw = req.headers.cookie;
  if (!raw) return {};

  return raw.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1));
    acc[key] = value;
    return acc;
  }, {});
}

function isSecureRequest(req) {
  if (process.env.NODE_ENV === 'production') {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (typeof forwardedProto === 'string') {
      return forwardedProto.split(',')[0].trim() === 'https';
    }
  }
  return false;
}

function getCookieOptions(req, maxAgeMs) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function createTokens(userId, tokenVersion = 0) {
  const payload = { userId, tokenVersion };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export function setAuthCookies(req, res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(req, 15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req, 7 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(req, res) {
  const options = { ...getCookieOptions(req, 0), maxAge: 0 };
  res.clearCookie(ACCESS_COOKIE_NAME, options);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

export function getRefreshTokenFromRequest(req) {
  const cookies = parseCookies(req);
  return cookies[REFRESH_COOKIE_NAME] || null;
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const cookies = parseCookies(req);
  const token = bearerToken || cookies[ACCESS_COOKIE_NAME] || null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  pool.query(
    'SELECT COALESCE(token_version, 0) AS token_version FROM public.users WHERE id = $1',
    [decoded.userId]
  )
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const currentVersion = Number(result.rows[0].token_version || 0);
      const tokenVersion = Number(decoded.tokenVersion || 0);
      if (currentVersion !== tokenVersion) {
        return res.status(403).json({ error: 'Session invalidated. Please log in again.' });
      }

      req.userId = decoded.userId;
      req.tokenVersion = tokenVersion;
      next();
      return null;
    })
    .catch((err) => {
      console.error('Token validation error:', err);
      return res.status(500).json({ error: 'Failed to validate token' });
    });
}

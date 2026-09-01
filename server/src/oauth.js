import fetch from 'node-fetch';
import bcryptjs from 'bcryptjs';
import { randomUUID } from 'crypto';

const AUTHENTIK_SERVER_URL = (process.env.AUTHENTIK_SERVER_URL || '').trim();
const AUTHENTIK_CLIENT_ID = (process.env.AUTHENTIK_CLIENT_ID || '').trim();
const AUTHENTIK_CLIENT_SECRET = (process.env.AUTHENTIK_CLIENT_SECRET || '').trim();
const AUTHENTIK_REDIRECT_URI = (process.env.AUTHENTIK_REDIRECT_URI || '').trim();

const OIDC_CACHE_MS = 3600000;
const oidcCache = new Map();

function normalizeSettingValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value).trim();
}

async function getAuthentikRuntimeConfig(pool, fallbackRedirectUri = '') {
  const defaults = {
    serverUrl: AUTHENTIK_SERVER_URL,
    clientId: AUTHENTIK_CLIENT_ID,
    clientSecret: AUTHENTIK_CLIENT_SECRET,
    redirectUri: AUTHENTIK_REDIRECT_URI || fallbackRedirectUri,
  };

  if (!pool) {
    return defaults;
  }

  const result = await pool.query(
    `SELECT setting_key, setting_value
     FROM public.app_settings
     WHERE setting_key = ANY($1::text[])`,
    [[
      'authentik_url',
      'authentik_client_id',
      'authentik_client_secret',
      'authentik_redirect_uri',
    ]]
  );

  const fromDb = {
    serverUrl: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  };

  for (const row of result.rows) {
    const key = row.setting_key;
    const value = normalizeSettingValue(row.setting_value);

    if (key === 'authentik_url') fromDb.serverUrl = value;
    if (key === 'authentik_client_id') fromDb.clientId = value;
    if (key === 'authentik_client_secret') fromDb.clientSecret = value;
    if (key === 'authentik_redirect_uri') fromDb.redirectUri = value;
  }

  return {
    serverUrl: fromDb.serverUrl || defaults.serverUrl,
    clientId: fromDb.clientId || defaults.clientId,
    clientSecret: fromDb.clientSecret || defaults.clientSecret,
    redirectUri: fromDb.redirectUri || defaults.redirectUri,
  };
}

/**
 * Check if Authentik is configured
 */
export async function isAuthentikConfigured(pool, fallbackRedirectUri = '') {
  const config = await getAuthentikRuntimeConfig(pool, fallbackRedirectUri);
  return !!(config.serverUrl && config.clientId && config.clientSecret);
}

/**
 * Get OIDC configuration from Authentik
 * Cached for 1 hour
 */
async function getOIDCConfig(serverUrl) {
  const normalizedInput = (serverUrl || '').trim();
  const baseUrl = normalizedInput.replace(/\/$/, '');
  const looksLikeWellKnownUrl = /\/\.well-known\/openid-configuration\/?$/i.test(baseUrl);
  const oidcConfigUrls = looksLikeWellKnownUrl
    ? [baseUrl]
    : [`${baseUrl}/.well-known/openid-configuration`];
  const now = Date.now();
  const cacheKey = oidcConfigUrls[0] || baseUrl;
  const cached = oidcCache.get(cacheKey);
  if (cached && now - cached.cachedAt < OIDC_CACHE_MS) {
    return cached.config;
  }

  let lastError = null;

  for (const oidcConfigUrl of oidcConfigUrls) {
    try {
      const response = await fetch(oidcConfigUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch OIDC config from ${oidcConfigUrl}: ${response.status} ${response.statusText}`);
      }

      const config = await response.json();
      oidcCache.set(cacheKey, { config, cachedAt: now });
      return config;
    } catch (err) {
      lastError = err;
    }
  }

  const guidance = 'Use the Authentik issuer URL (for example https://auth.example.com/application/o/<provider>/) or the full .well-known/openid-configuration URL.';
  const message = `Error fetching OIDC config for "${serverUrl}": ${lastError?.message || 'Unknown error'}. ${guidance}`;
  const wrappedError = new Error(message);
  wrappedError.cause = lastError;
  console.error(message);
  throw wrappedError;
}

/**
 * Generate OAuth authorization URL
 */
export async function getAuthorizationURL(pool, fallbackRedirectUri = '') {
  const runtimeConfig = await getAuthentikRuntimeConfig(pool, fallbackRedirectUri);
  if (!(runtimeConfig.serverUrl && runtimeConfig.clientId && runtimeConfig.clientSecret)) {
    throw new Error('Authentik is not configured');
  }

  if (!runtimeConfig.redirectUri) {
    throw new Error('Authentik redirect URI is not configured');
  }

  const config = await getOIDCConfig(runtimeConfig.serverUrl);
  const state = randomUUID();
  const nonce = randomUUID();

  const params = new URLSearchParams({
    client_id: runtimeConfig.clientId,
    redirect_uri: runtimeConfig.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce,
  });

  return {
    url: `${config.authorization_endpoint}?${params.toString()}`,
    state,
    nonce,
  };
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code, runtimeConfig) {
  const config = await getOIDCConfig(runtimeConfig.serverUrl);

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: runtimeConfig.clientId,
    client_secret: runtimeConfig.clientSecret,
    redirect_uri: runtimeConfig.redirectUri,
  });

  const response = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get user info from Authentik
 */
async function getUserInfo(accessToken, runtimeConfig) {
  const config = await getOIDCConfig(runtimeConfig.serverUrl);

  const response = await fetch(config.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Handle OAuth callback
 * Receives: code, state from Authentik
 * Returns: { accessToken, refreshToken, userId, isNewUser }
 */
export async function handleOAuthCallback(pool, code, state, expectedState, options = {}) {
  if (!code) {
    throw new Error('Missing authorization code');
  }

  // Validate state (security measure against CSRF)
  if (state !== expectedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  const runtimeConfig = await getAuthentikRuntimeConfig(pool, options.fallbackRedirectUri || '');
  if (!(runtimeConfig.serverUrl && runtimeConfig.clientId && runtimeConfig.clientSecret)) {
    throw new Error('Authentik is not configured');
  }

  if (!runtimeConfig.redirectUri) {
    throw new Error('Authentik redirect URI is not configured');
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code, runtimeConfig);
    const { access_token: accessToken } = tokenResponse;

    const userInfo = await getUserInfo(accessToken, runtimeConfig);
    const { sub: authentikId, email, preferred_username, name } = userInfo;
    const linkUserId = options.linkUserId || null;

    if (!authentikId) {
      throw new Error('OAuth provider did not return subject identifier');
    }

    if (!email && !linkUserId) {
      throw new Error('OAuth provider did not return email');
    }

    const client = await pool.connect();
    let userId;
    let isNewUser = false;
    let isLinked = false;

    try {
      await client.query('BEGIN');

      const existingOauthResult = await client.query(
        `SELECT user_id
         FROM public.user_oauth_providers
         WHERE provider = $1 AND provider_id = $2
         LIMIT 1`,
        ['authentik', authentikId]
      );

      if (linkUserId) {
        if (existingOauthResult.rows.length > 0 && existingOauthResult.rows[0].user_id !== linkUserId) {
          throw new Error('Deze Authentik-identiteit is al gekoppeld aan een ander account');
        }

        userId = linkUserId;
        isLinked = true;
      } else {
        if (existingOauthResult.rows.length > 0) {
          userId = existingOauthResult.rows[0].user_id;
        } else {
          const userResult = await client.query(
            'SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [email]
          );

          if (userResult.rows.length > 0) {
            userId = userResult.rows[0].id;
          } else {
            userId = randomUUID();
            const randomPassword = await bcryptjs.hash(randomUUID(), 10);

            await client.query(
              'INSERT INTO public.users (id, email, password_hash) VALUES ($1, $2, $3)',
              [userId, email, randomPassword]
            );

            await client.query('INSERT INTO public.profiles (user_id) VALUES ($1)', [userId]);

            const roleCount = await client.query('SELECT COUNT(*) FROM public.user_roles');
            const role = roleCount.rows[0].count === '0' ? 'admin' : 'user';

            await client.query(
              'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)',
              [userId, role]
            );

            isNewUser = true;
          }
        }
      }

      await client.query(
        `INSERT INTO public.user_oauth_providers (user_id, provider, provider_id, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, provider)
         DO UPDATE SET provider_id = EXCLUDED.provider_id, display_name = EXCLUDED.display_name, updated_at = now()`,
        [userId, 'authentik', authentikId, name || preferred_username || email || authentikId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      userId,
      email: email || null,
      isNewUser,
      isLinked,
    };
  } catch (err) {
    console.error('OAuth callback error:', err);
    throw err;
  }
}

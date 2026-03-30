import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import bcryptjs from 'bcryptjs';

const AUTHENTIK_SERVER_URL = process.env.AUTHENTIK_SERVER_URL || '';
const AUTHENTIK_CLIENT_ID = process.env.AUTHENTIK_CLIENT_ID || '';
const AUTHENTIK_CLIENT_SECRET = process.env.AUTHENTIK_CLIENT_SECRET || '';
const AUTHENTIK_REDIRECT_URI = process.env.AUTHENTIK_REDIRECT_URI || '';

const OIDC_CONFIG_URL = `${AUTHENTIK_SERVER_URL}/.well-known/openid-configuration`;

let cachedOIDCConfig = null;
let configCachedAt = 0;

/**
 * Check if Authentik is configured
 */
export function isAuthentikConfigured() {
  return !!(AUTHENTIK_SERVER_URL && AUTHENTIK_CLIENT_ID && AUTHENTIK_CLIENT_SECRET);
}

/**
 * Get OIDC configuration from Authentik
 * Cached for 1 hour
 */
async function getOIDCConfig() {
  const now = Date.now();
  if (cachedOIDCConfig && now - configCachedAt < 3600000) {
    return cachedOIDCConfig;
  }

  try {
    const response = await fetch(OIDC_CONFIG_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC config: ${response.statusText}`);
    }

    cachedOIDCConfig = await response.json();
    configCachedAt = now;
    return cachedOIDCConfig;
  } catch (err) {
    console.error('Error fetching OIDC config:', err);
    throw err;
  }
}

/**
 * Generate OAuth authorization URL
 */
export async function getAuthorizationURL() {
  if (!isAuthentikConfigured()) {
    throw new Error('Authentik is not configured');
  }

  const config = await getOIDCConfig();
  const state = uuidv4();
  const nonce = uuidv4();

  // Store state/nonce for validation on callback (consider using encrypted session)
  const params = new URLSearchParams({
    client_id: AUTHENTIK_CLIENT_ID,
    redirect_uri: AUTHENTIK_REDIRECT_URI,
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
async function exchangeCodeForTokens(code) {
  const config = await getOIDCConfig();

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: AUTHENTIK_CLIENT_ID,
    client_secret: AUTHENTIK_CLIENT_SECRET,
    redirect_uri: AUTHENTIK_REDIRECT_URI,
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
async function getUserInfo(accessToken) {
  const config = await getOIDCConfig();

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
export async function handleOAuthCallback(pool, code, state, expectedState) {
  if (!code) {
    throw new Error('Missing authorization code');
  }

  // Validate state (security measure against CSRF)
  if (state !== expectedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);
    const { access_token: accessToken, refresh_token: refreshToken } = tokenResponse;

    // Get user info
    const userInfo = await getUserInfo(accessToken);
    const { sub: authentikId, email, preferred_username, name } = userInfo;

    if (!email) {
      throw new Error('OAuth provider did not return email');
    }

    // Check/create user in database
    const client = await pool.connect();
    let userId, isNewUser = false;

    try {
      await client.query('BEGIN');

      // Look up user by email
      const userResult = await client.query(
        'SELECT id FROM public.users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      } else {
        // Create new user from OAuth
        userId = uuidv4();
        // Generate a secure random password (user won't use it, they'll use OAuth)
        const randomPassword = await bcryptjs.hash(uuidv4(), 10);

        await client.query(
          'INSERT INTO public.users (id, email, password_hash) VALUES ($1, $2, $3)',
          [userId, email, randomPassword]
        );

        // Create profile
        await client.query('INSERT INTO public.profiles (user_id) VALUES ($1)', [userId]);

        // Make first user admin
        const roleCount = await client.query('SELECT COUNT(*) FROM public.user_roles');
        const role = roleCount.rows[0].count === '0' ? 'admin' : 'user';

        await client.query(
          'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)',
          [userId, role]
        );

        // Store OAuth provider info for future reference
        await client.query(
          `INSERT INTO public.user_oauth_providers (user_id, provider, provider_id, display_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, provider) DO UPDATE
           SET provider_id = $3, display_name = $4`,
          [userId, 'authentik', authentikId, name || preferred_username || email]
        );

        isNewUser = true;
      }

      // Update profile with OAuth name if available
      if (name || preferred_username) {
        const displayName = name || preferred_username;
        // Split name into first/last if possible
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        await client.query(
          `UPDATE public.profiles
           SET company_name = $1
           WHERE user_id = $2`,
          [displayName, userId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      userId,
      email,
      isNewUser,
      // Note: Don't return Authentik tokens directly
      // These should be exchanged for app JWTs
    };
  } catch (err) {
    console.error('OAuth callback error:', err);
    throw err;
  }
}

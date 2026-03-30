/**
 * OAuth Routes for Authentik Integration
 * Add these to server/src/index.js after regular auth routes
 */

function getFallbackRedirectUri(req) {
  const publicUrl = (process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (publicUrl) {
    return `${publicUrl}/auth/callback`;
  }

  const origin = req.get('origin');
  if (origin) {
    return `${origin.replace(/\/$/, '')}/auth/callback`;
  }

  const host = req.get('host');
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : req.protocol) || 'http';

  if (!host) {
    return '';
  }

  return `${proto}://${host}/auth/callback`;
}

export function setupOAuthRoutes(app, pool, authenticateToken, isAuthentikConfigured, getAuthorizationURL, handleOAuthCallback, createTokens, setAuthCookies) {
  /**
   * POST /api/auth/oauth/authorize
   * Get Authentik authorization URL
   */
  app.post('/api/auth/oauth/authorize', async (req, res) => {
    const fallbackRedirectUri = getFallbackRedirectUri(req);
    if (!(await isAuthentikConfigured(pool, fallbackRedirectUri))) {
      return res.status(400).json({ error: 'OAuth is not configured' });
    }

    try {
      const { url, state } = await getAuthorizationURL(pool, fallbackRedirectUri);
      res.json({
        url,
        state,
      });
    } catch (err) {
      console.error('Error getting authorization URL:', err);
      res.status(500).json({ error: 'Failed to get authorization URL' });
    }
  });

  /**
   * POST /api/auth/oauth/callback
   * Handle OAuth callback from Authentik
   * Body: { code, state }
   */
  app.post('/api/auth/oauth/callback', async (req, res) => {
    const fallbackRedirectUri = getFallbackRedirectUri(req);
    if (!(await isAuthentikConfigured(pool, fallbackRedirectUri))) {
      return res.status(400).json({ error: 'OAuth is not configured' });
    }

    const { code, state, sessionState } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    try {
      // Validate state (CSRF protection)
      if (state !== sessionState) {
        return res.status(400).json({ error: 'Invalid state - possible CSRF attack' });
      }

      // Handle callback and get user
      const { userId, email, isNewUser } = await handleOAuthCallback(
        pool,
        code,
        state,
        sessionState,
        { fallbackRedirectUri }
      );

      // Issue JWT tokens
      const tokenVersionResult = await pool.query(
        'SELECT COALESCE(token_version, 0) AS token_version FROM public.users WHERE id = $1',
        [userId]
      );
      const tokenVersion = Number(tokenVersionResult.rows[0]?.token_version || 0);
      const { accessToken, refreshToken } = createTokens(userId, tokenVersion);
      setAuthCookies(req, res, accessToken, refreshToken);

      res.json({
        accessToken,
        refreshToken,
        userId,
        email,
        isNewUser,
      });
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.status(400).json({ error: err.message || 'OAuth callback failed' });
    }
  });

  /**
   * GET /api/auth/oauth/config
   * Return public OAuth configuration for frontend
   */
  app.get('/api/auth/oauth/config', (req, res) => {
    const fallbackRedirectUri = getFallbackRedirectUri(req);
    isAuthentikConfigured(pool, fallbackRedirectUri)
      .then((enabled) => {
        res.json({ enabled });
      })
      .catch((err) => {
        console.error('Error getting OAuth config status:', err);
        res.status(500).json({ error: 'Failed to get OAuth config status' });
      });
  });

  /**
   * POST /api/auth/oauth/link/authorize
   * Link an existing account to Authentik (for current user)
   * Requires: authentication token/session
   */
  app.post('/api/auth/oauth/link/authorize', authenticateToken, async (req, res) => {
    const fallbackRedirectUri = getFallbackRedirectUri(req);
    if (!(await isAuthentikConfigured(pool, fallbackRedirectUri))) {
      return res.status(400).json({ error: 'OAuth is not configured' });
    }

    try {
      const { url, state } = await getAuthorizationURL(pool, fallbackRedirectUri);
      res.json({ url, state });
    } catch (err) {
      console.error('Error getting Authentik link authorization URL:', err);
      res.status(500).json({ error: 'Failed to get account link authorization URL' });
    }
  });

  /**
   * POST /api/auth/oauth/link/callback
   * Complete linking to Authentik for logged-in user
   */
  app.post('/api/auth/oauth/link/callback', authenticateToken, async (req, res) => {
    const fallbackRedirectUri = getFallbackRedirectUri(req);
    if (!(await isAuthentikConfigured(pool, fallbackRedirectUri))) {
      return res.status(400).json({ error: 'OAuth is not configured' });
    }

    const { code, state, sessionState } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    if (state !== sessionState) {
      return res.status(400).json({ error: 'Invalid state - possible CSRF attack' });
    }

    try {
      const result = await handleOAuthCallback(pool, code, state, sessionState, {
        fallbackRedirectUri,
        linkUserId: req.userId,
      });

      res.json({
        success: true,
        userId: result.userId,
        isLinked: result.isLinked,
      });
    } catch (err) {
      console.error('OAuth link callback error:', err);
      res.status(400).json({ error: err.message || 'OAuth link callback failed' });
    }
  });
}

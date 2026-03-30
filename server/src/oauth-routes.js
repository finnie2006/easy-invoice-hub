/**
 * OAuth Routes for Authentik Integration
 * Add these to server/src/index.js after regular auth routes
 */

export function setupOAuthRoutes(app, pool, isAuthentikConfigured, getAuthorizationURL, handleOAuthCallback, createTokens) {
  /**
   * POST /api/auth/oauth/authorize
   * Get Authentik authorization URL
   */
  app.post('/api/auth/oauth/authorize', async (req, res) => {
    if (!isAuthentikConfigured()) {
      return res.status(400).json({ error: 'OAuth is not configured' });
    }

    try {
      const { url, state, nonce } = await getAuthorizationURL();

      // Store state/nonce in session or signed cookie for verification
      // For now, return for frontend to handle
      res.json({
        url,
        // Frontend should store state in session storage for CSRF validation
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
    if (!isAuthentikConfigured()) {
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
      const { userId, email, isNewUser } = await handleOAuthCallback(pool, code, state, sessionState);

      // Issue JWT tokens
      const { accessToken, refreshToken } = createTokens(userId);

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
    res.json({
      enabled: isAuthentikConfigured(),
    });
  });

  /**
   * POST /api/auth/oauth/link
   * Link an existing account to Authentik (for current user)
   * Requires: authentication token
   */
  app.post('/api/auth/oauth/link', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!isAuthentikConfigured()) {
      return res.status(400).json({ error: 'OAuth is not configured' });
    }

    // Placeholder: Implementation would verify token and return linking URL
    res.json({
      message: 'Account linking not yet implemented',
    });
  });
}

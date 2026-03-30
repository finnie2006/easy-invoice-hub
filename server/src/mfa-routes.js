/**
 * MFA Authentication Routes
 * Add these to server/src/index.js after the regular auth routes
 */

import bcryptjs from 'bcryptjs';

import {
  generateTOTPSecret,
  verifyTOTPToken,
  generateRecoveryCodes,
  verifyRecoveryCode,
  checkMFARateLimit,
  recordMFAAttempt,
  clearMFAAttempts,
} from './mfa.js';

function ensureMFATables(pool) {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_mfa (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
      totp_secret text,
      totp_enabled boolean DEFAULT false,
      recovery_codes text[] DEFAULT ARRAY[]::text[],
      backup_codes_generated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.user_mfa_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      failed_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export function setupMFARoutes(app, pool, authenticateToken, createTokens, setAuthCookies) {
  // Lazy one-time schema bootstrap for existing deployments that missed MFA tables.
  let mfaSchemaReady;
  const ensureSchema = async () => {
    if (!mfaSchemaReady) {
      mfaSchemaReady = ensureMFATables(pool);
    }
    await mfaSchemaReady;
  };

  /**
   * POST /api/auth/mfa/setup
   * Generate TOTP secret and recovery codes
   * Returns: { secret, qrCode, recoveryCodes }
   */
  app.post('/api/auth/mfa/setup', authenticateToken, async (req, res) => {
    try {
      await ensureSchema();

      // Check if user already has MFA enabled
      await pool.query(
        'SELECT id FROM public.user_mfa WHERE user_id = $1',
        [req.userId]
      );

      const { secret, qrCode } = await generateTOTPSecret(req.userId);
      const recoveryCodes = generateRecoveryCodes();

      // Store temporary (not yet verified) MFA data in a separate field or cache
      // For now, we'll just return it - verification happens on next endpoint

      res.json({
        secret,
        qrCode,
        recoveryCodes,
        message: 'Verify with your first TOTP code to enable MFA',
      });
    } catch (err) {
      console.error('Error setting up MFA:', err);
      res.status(500).json({ error: 'Failed to setup MFA' });
    }
  });

  /**
   * POST /api/auth/mfa/verify
   * Verify TOTP token and save MFA configuration
   * Body: { secret, totpToken }
   */
  app.post('/api/auth/mfa/verify', authenticateToken, async (req, res) => {
    const { secret, totpToken } = req.body;

    if (!secret || !totpToken) {
      return res.status(400).json({ error: 'Secret and TOTP token required' });
    }

    try {
      await ensureSchema();

      const isValid = verifyTOTPToken(secret, totpToken);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid TOTP token' });
      }

      const recoveryCodes = generateRecoveryCodes();

      // Save MFA configuration
      const existing = await pool.query(
        'SELECT id FROM public.user_mfa WHERE user_id = $1',
        [req.userId]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await pool.query(
          `UPDATE public.user_mfa
           SET totp_secret = $1, totp_enabled = true, recovery_codes = $2, backup_codes_generated_at = NOW()
           WHERE user_id = $3`,
          [secret, recoveryCodes, req.userId]
        );
      } else {
        // Create new
        await pool.query(
          `INSERT INTO public.user_mfa (user_id, totp_secret, totp_enabled, recovery_codes, backup_codes_generated_at)
           VALUES ($1, $2, true, $3, NOW())`,
          [req.userId, secret, recoveryCodes]
        );
      }

      res.json({
        success: true,
        recoveryCodes,
        message: 'MFA enabled. Save these recovery codes in a safe place.',
      });
    } catch (err) {
      console.error('Error verifying MFA:', err);
      res.status(500).json({ error: 'Failed to verify MFA' });
    }
  });

  /**
   * GET /api/auth/mfa/status
   * Check if user has MFA enabled
   */
  app.get('/api/auth/mfa/status', authenticateToken, async (req, res) => {
    try {
      await ensureSchema();

      const result = await pool.query(
        'SELECT totp_enabled FROM public.user_mfa WHERE user_id = $1',
        [req.userId]
      );

      const mfaEnabled = result.rows.length > 0 && result.rows[0].totp_enabled;
      res.json({ mfaEnabled });
    } catch (err) {
      console.error('Error checking MFA status:', err);
      res.status(500).json({ error: 'Failed to check MFA status' });
    }
  });

  /**
   * POST /api/auth/mfa/disable
   * Disable MFA for user
   * Body: { password } - require password confirmation
   */
  app.post('/api/auth/mfa/disable', authenticateToken, async (req, res) => {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required to disable MFA' });
    }

    try {
      await ensureSchema();

      // Verify password
      const userResult = await pool.query(
        'SELECT password_hash FROM public.users WHERE id = $1',
        [req.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcryptjs.compare(password, userResult.rows[0].password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      // Disable MFA
      await pool.query(
        'UPDATE public.user_mfa SET totp_enabled = false, totp_secret = NULL, recovery_codes = ARRAY[]::text[] WHERE user_id = $1',
        [req.userId]
      );

      res.json({ success: true, message: 'MFA disabled' });
    } catch (err) {
      console.error('Error disabling MFA:', err);
      res.status(500).json({ error: 'Failed to disable MFA' });
    }
  });

  /**
   * POST /api/auth/mfa/verify-token
   * Verify TOTP or recovery code during login
   * Body: { totpToken } or { recoveryCode }
   * Note: This is called after username/password auth, before issuing JWT
   */
  app.post('/api/auth/mfa/verify-token', async (req, res) => {
    const { userId, totpToken, recoveryCode } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    if (!totpToken && !recoveryCode) {
      return res.status(400).json({ error: 'TOTP token or recovery code required' });
    }

    try {
      await ensureSchema();

      // Check rate limiting
      const rateLimited = await checkMFARateLimit(pool, userId);
      if (rateLimited) {
        return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
      }

      // Get user's MFA data
      const mfaResult = await pool.query(
        'SELECT totp_secret, recovery_codes FROM public.user_mfa WHERE user_id = $1 AND totp_enabled = true',
        [userId]
      );

      if (mfaResult.rows.length === 0) {
        return res.status(400).json({ error: 'MFA not enabled for user' });
      }

      const { totp_secret: secret, recovery_codes: codes } = mfaResult.rows[0];
      let isValid = false;

      if (totpToken) {
        isValid = verifyTOTPToken(secret, totpToken);
      } else if (recoveryCode) {
        isValid = verifyRecoveryCode(codes, recoveryCode);
        if (isValid) {
          // Update recovery codes after use
          await pool.query(
            'UPDATE public.user_mfa SET recovery_codes = $1 WHERE user_id = $2',
            [codes, userId]
          );
        }
      }

      if (!isValid) {
        await recordMFAAttempt(pool, userId);
        return res.status(401).json({ error: 'Invalid TOTP token or recovery code' });
      }

      // Clear failed attempts on success
      await clearMFAAttempts(pool, userId);

      // Issue tokens
      const tokenVersionResult = await pool.query(
        'SELECT COALESCE(token_version, 0) AS token_version FROM public.users WHERE id = $1',
        [userId]
      );
      const tokenVersion = Number(tokenVersionResult.rows[0]?.token_version || 0);
      const { accessToken, refreshToken } = createTokens(userId, tokenVersion);
      setAuthCookies(req, res, accessToken, refreshToken);
      res.json({ accessToken, refreshToken, userId });
    } catch (err) {
      console.error('Error verifying MFA token:', err);
      res.status(500).json({ error: 'Failed to verify MFA token' });
    }
  });
}

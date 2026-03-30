import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Generate a new TOTP secret for the user
 * Returns { secret, qrCode }
 */
export async function generateTOTPSecret(email, appName = 'Easy Invoice Hub') {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${email})`,
    length: 32,
  });

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCode,
  };
}

/**
 * Verify a TOTP token
 * Returns true/false
 */
export function verifyTOTPToken(secret, token) {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 time window before/after (30 seconds)
    });

    return verified;
  } catch (err) {
    console.error('TOTP verification error:', err);
    return false;
  }
}

/**
 * Generate recovery codes (10 codes, 8 characters each)
 * Format: XXXX-XXXX
 */
export function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

/**
 * Verify and consume a recovery code
 * Returns true if valid and removes it from array
 */
export function verifyRecoveryCode(codes, code) {
  const index = codes.indexOf(code.toUpperCase());
  if (index === -1) {
    return false;
  }
  codes.splice(index, 1);
  return true;
}

/**
 * Check if too many failed MFA attempts (rate limiting)
 * Max 5 attempts per 15 minutes
 */
export async function checkMFARateLimit(pool, userId) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const result = await pool.query(
    'SELECT COUNT(*) as attempt_count FROM public.user_mfa_attempts WHERE user_id = $1 AND failed_at > $2',
    [userId, fifteenMinutesAgo]
  );

  const attemptCount = parseInt(result.rows[0].attempt_count, 10);
  return attemptCount >= 5;
}

/**
 * Record a failed MFA attempt
 */
export async function recordMFAAttempt(pool, userId) {
  await pool.query(
    'INSERT INTO public.user_mfa_attempts (user_id) VALUES ($1)',
    [userId]
  );
}

/**
 * Clear failed MFA attempts on success
 */
export async function clearMFAAttempts(pool, userId) {
  await pool.query(
    'DELETE FROM public.user_mfa_attempts WHERE user_id = $1',
    [userId]
  );
}

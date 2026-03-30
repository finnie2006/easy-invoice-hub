# Two-Factor Authentication (2FA) Implementation Guide

This document describes the TOTP-based 2FA system added to Easy Invoice Hub.

## Files Added

### Backend
- `server/src/mfa.js` - TOTP utilities (generate, verify, recovery codes)
- `server/src/mfa-routes.js` - Auth endpoints for MFA setup and verification
- Database migration: `001-initial-schema.sql` (adds user_mfa tables)

### Frontend
- `src/components/auth/MFASetup.tsx` - 2FA setup wizard with QR code
- `src/components/auth/MFAVerify.tsx` - 2FA login verification UI
- `src/components/settings/MFASettings.tsx` - 2FA management in settings

## Database Schema

```sql
CREATE TABLE user_mfa (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES users(id),
  totp_secret text,           -- Base32 encoded secret
  totp_enabled boolean,        -- Whether MFA is active
  recovery_codes text[],       -- Unused recovery codes
  backup_codes_generated_at timestamptz
);

CREATE TABLE user_mfa_attempts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  failed_at timestamptz        -- For rate limiting (max 5 attempts/15min)
);
```

## API Endpoints

### Setup 2FA
```
POST /api/auth/mfa/setup
Authorization: Bearer <token>

Response:
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,...",
  "recoveryCodes": ["AAAA-BBBB", "CCCC-DDDD", ...],
  "message": "Verify with your first TOTP code to enable MFA"
}
```

### Verify 2FA (confirm setup)
```
POST /api/auth/mfa/verify
Authorization: Bearer <token>

Body:
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "totpToken": "123456"
}

Response:
{
  "success": true,
  "recoveryCodes": ["AAAA-BBBB", ...],
  "message": "MFA enabled. Save these recovery codes..."
}
```

### Check MFA Status
```
GET /api/auth/mfa/status
Authorization: Bearer <token>

Response:
{
  "mfaEnabled": true
}
```

### Verify TOTP During Login
```
POST /api/auth/mfa/verify-token

Body (option 1 - TOTP):
{
  "userId": "user-id",
  "totpToken": "123456"
}

Body (option 2 - Recovery Code):
{
  "userId": "user-id",
  "recoveryCode": "AAAA-BBBB"
}

Response:
{
  "accessToken": "...",
  "refreshToken": "...",
  "userId": "..."
}
```

### Disable 2FA
```
POST /api/auth/mfa/disable
Authorization: Bearer <token>

Body:
{
  "password": "user-password"
}

Response:
{
  "success": true,
  "message": "MFA disabled"
}
```

## Integration Steps

### 1. Install Dependencies
```bash
cd server
npm install speakeasy qrcode
npm audit fix
```

### 2. Add MFA Routes to Backend
In `server/src/index.js`, add this after the regular auth routes:

```javascript
import { setupMFARoutes } from './mfa-routes.js';
import { createTokens } from './auth.js';

// ... existing code ...

// Add after auth routes but before app.listen()
setupMFARoutes(app, pool, authenticateToken);
```

### 3. Update Login Flow (Optional - for enforced 2FA)
If you want to require 2FA during login:

```javascript
// After password verification succeeds:
// Check if user has MFA enabled
const mfaResult = await pool.query(
  'SELECT totp_enabled FROM user_mfa WHERE user_id = $1',
  [userId]
);

if (mfaResult.rows[0]?.totp_enabled) {
  // Return temporary token (not full JWT) + require MFA verification
  // Frontend calls /api/auth/mfa/verify-token with this + user ID
  res.json({
    requiresMFA: true,
    userId: userId,
    temporaryToken: tempToken
  });
} else {
  // Proceed with normal token issuance
  const { accessToken, refreshToken } = createTokens(userId);
  res.json({ accessToken, refreshToken, userId });
}
```

### 4. Add MFA Settings UI
In `src/pages/Settings.tsx`:

```typescript
import { MFASettings } from '@/components/settings/MFASettings';

// Inside settings page:
<MFASettings />
```

### 5. Add MFA to Login Page (If Enforced)
In `src/pages/AuthPage.tsx`:

```typescript
import { MFAVerify } from '@/components/auth/MFAVerify';

// After password auth:
if (response.data.requiresMFA) {
  return (
    <MFAVerify
      userId={response.data.userId}
      onVerify={(data) => {
        // Store tokens, redirect to app
      }}
      onError={(error) => {
        // Show error
      }}
    />
  );
}
```

## Security Notes

1. **TOTP Window**: Accepts tokens from current and ±1 time window (±30 seconds) to account for clock drift
2. **Rate Limiting**: Max 5 failed attempts per 15 minutes per user
3. **Recovery Codes**: 10 codes per setup, single-use, stored in DB
4. **Password Confirmation**: Required to disable MFA
5. **Secrets**: Stored encrypted in database (consider adding database-level encryption)

## Testing

```bash
# Test TOTP generation
npm test --  server/src/mfa.test.js

# Manual testing with Google Authenticator:
# 1. Setup MFA via POST /api/auth/mfa/setup
# 2. Scan QR code with Google Authenticator
# 3. Verify with token via POST /api/auth/mfa/verify
```

## Future Enhancements

- [ ] SMS backup codes
- [ ] WebAuthN / FIDO2 support
- [ ] Hardware keys (YubiKey, etc.)
- [ ] Enforcement policies (force 2FA for admins)
- [ ] Backup code regeneration endpoints
- [ ] MFA audit logging

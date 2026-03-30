# Authentik OAuth Integration Guide

This document describes how to set up and configure Authentik OAuth integration with Easy Invoice Hub.

## Overview

Easy Invoice Hub supports OAuth 2.0 authentication via Authentik, allowing users to:
- Sign in with their Authentik credentials
- Automatically create accounts on first login
- Use 2FA through Authentik or app-level TOTP

## Prerequisites

1. **Authentik Server** running and accessible (e.g., `https://authentik.example.com`)
2. **OAuth2/OIDC Application** created in Authentik
3. **Easy Invoice Hub** deployed with HTTPS in production

## Step 1: Create OAuth Application in Authentik

### In Authentik Console:

1. Navigate to **Applications > Applications**
2. Click **Create**
3. Fill in the form:

   | Field | Value |
   |-------|-------|
   | Name | Easy Invoice Hub |
   | Slug | easy-invoice-hub |
   | Provider | Create New Provider (see below) |

4. Click **Create**

### Create OIDC Provider:

1. In Authentik Console, go to **Providers > Providers**
2. Click **Create** and select **OpenID Connect**
3. Configure:

   | Field | Value |
   |-------|-------|
   | Name | Easy Invoice Hub OIDC |
   | Client Type | Confidential |
   | Redirect URIs | `http://localhost:8080/auth/callback` (dev) or `https://your-domain/auth/callback` (prod) |
   | Scopes | openid, profile, email (default) |

4. Click **Save**
5. Note the **Client ID** and **Client Secret** (you'll need these)

## Step 2: Configure Easy Invoice Hub

### Environment Variables

Set these in your `.env` file (or Docker environment):

```env
# Authentik OAuth Configuration
AUTHENTIK_SERVER_URL=https://authentik.example.com
AUTHENTIK_CLIENT_ID=your-client-id
AUTHENTIK_CLIENT_SECRET=your-client-secret
AUTHENTIK_REDIRECT_URI=http://localhost:8080/auth/callback
```

### For Docker:

If using Docker Compose, add to your `.env`:

```env
# Pass through to container similarly
AUTHENTIK_SERVER_URL=https://authentik.yourdomain.com
AUTHENTIK_CLIENT_ID=xxx
AUTHENTIK_CLIENT_SECRET=xxx
AUTHENTIK_REDIRECT_URI=https://your-domain/auth/callback
```

## Step 3: Deploy Backend Changes

The backend OAuth implementation is in `server/src/oauth.js` and `server/src/oauth-routes.js`.

To integrate into your running server:

1. **Install additional dependencies:**
   ```bash
   cd server
   npm install node-fetch
   ```

2. **Update `server/src/index.js`** to include OAuth routes:
   ```javascript
   import { setupOAuthRoutes } from './oauth-routes.js';
   import { 
     isAuthentikConfigured,
     getAuthorizationURL,
     handleOAuthCallback,
   } from './oauth.js';
   import { createTokens } from './auth.js';

   // Add after regular auth routes:
   setupOAuthRoutes(
     app,
     pool,
     isAuthentikConfigured,
     getAuthorizationURL,
     handleOAuthCallback,
     createTokens
   );
   ```

3. **Restart the server**

## Step 4: Update Frontend Login Page

Add the Authentik login button to your login page:

```typescript
// src/pages/AuthPage.tsx

import { AuthentikLoginButton } from '@/components/auth/AuthentikLoginButton';

export default function AuthPage() {
  return (
    <div className="login-form">
      <AuthentikLoginButton />
      {/* Regular email/password form below */}
    </div>
  );
}
```

## Database Changes

The OAuth integration adds a new table:

```sql
CREATE TABLE user_oauth_providers (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  provider text,        -- "authentik"
  provider_id text,     -- Sub claim from Authentik
  display_name text,    -- User display name
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(user_id, provider)
);
```

This table tracks which OAuth providers are linked to each user account.

## OAuth Flow

1. **User clicks "Login with Authentik"**
2. Frontend calls `POST /api/auth/oauth/authorize`
3. Backend returns Authentik authorization URL
4. Frontend redirects to Authentik login
5. User authenticates in Authentik
6. Authentik redirects back to `/auth/callback?code=...&state=...`
7. Frontend calls `POST /api/auth/oauth/callback` with code
8. Backend exchanges code for ID token
9. Backend looks up or creates user
10. Backend returns JWT tokens
11. Frontend stores tokens and redirects to dashboard

## Account Linking (Optional)

Users can link an existing Easy Invoice Hub account to their Authentik account:

1. User logs in with email/password
2. In Settings, click "Link Authentik Account"
3. Redirects to Authentik authorization
4. On return, account is linked
5. User can now use either method to log in

**Note:** This feature requires account linking implementation:

```typescript
// POST /api/auth/oauth/link (requires authentication)
// Links current user to Authentik
```

## Troubleshooting

### OAuth button doesn't appear

- Check `GET /api/auth/oauth/config` returns `{ enabled: true }`
- Verify environment variables are set correctly
- Check server logs for configuration errors

### "Invalid state - possible CSRF attack"

- Session storage was cleared between steps
- Use private/incognito window to test
- Check browser's session storage on the callback page

### "OAuth provider did not return email"

- Ensure "email" is in requested scopes in Authentik provider
- Check Authentik user has email configured
- Verify user permissions in Authentik

### Users not being created automatically

- Check database permissions
- Review server logs for SQL errors
- Verify `user_oauth_providers` table exists

## Security Considerations

1. **CSRF Protection**: State parameter is verified on callback
2. **HTTPS Required**: Only use HTTP localhost for development
3. **Client Secret**: Never expose client secret to frontend
4. **Nonce**: Currently not validated (could be added for ID token validation)
5. **Email Verification**: Consider requiring email verification in Authentik

## Future Enhancements

- [ ] Account linking UI
- [ ] Multiple OAuth providers (Google, GitHub, etc.)
- [ ] ID token signature validation
- [ ] Nonce validation for enhanced security
- [ ] Automatic user profile sync from Authentik
- [ ] OAuth scope customization
- [ ] PKCE support for public clients

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/oauth/config` | GET | No | Get OAuth configuration status |
| `/api/auth/oauth/authorize` | POST | No | Get Authentik authorization URL |
| `/api/auth/oauth/callback` | POST | No | Handle OAuth callback |
| `/api/auth/oauth/link` | POST | Yes | Link account to Authentik |

## Testing

Use `curl` to test endpoints:

```bash
# Check if OAuth is enabled
curl http://localhost:3001/api/auth/oauth/config

# Get authorization URL
curl -X POST http://localhost:3001/api/auth/oauth/authorize
```

import crypto from 'crypto';

// app_settings keys that hold secrets: stored encrypted, never returned to the client.
export const SECRET_SETTING_KEYS = new Set(['smtp_password', 'authentik_client_secret']);

const ENCRYPTED_PREFIX = 'enc:v1:';

// Resolved lazily so dotenv has loaded before the key is derived.
function getSettingsEncryptionKey() {
  const secret = (
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'local-settings-development-secret'
  ).trim();
  return crypto.createHash('sha256').update(secret).digest();
}

export function isEncryptedSetting(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptSettingValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (isEncryptedSetting(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSettingsEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ENCRYPTED_PREFIX + [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSettingValue(value) {
  if (!isEncryptedSetting(value)) {
    return value === null || value === undefined ? '' : String(value);
  }

  try {
    const [iv, tag, data] = value.slice(ENCRYPTED_PREFIX.length).split('.');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getSettingsEncryptionKey(),
      Buffer.from(iv, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt app setting (was SETTINGS_ENCRYPTION_KEY/JWT_SECRET changed?):', err.message);
    return '';
  }
}

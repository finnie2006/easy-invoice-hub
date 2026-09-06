import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import crypto, { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import pool from './db.js';
import {
  authenticateToken,
  createTokens,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromRequest,
} from './auth.js';
import { setupMFARoutes } from './mfa-routes.js';
import { setupOAuthRoutes } from './oauth-routes.js';
import { isAuthentikConfigured, getAuthorizationURL, handleOAuthCallback } from './oauth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const configuredVapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const configuredVapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const hasConfiguredVapidKeys = Boolean(configuredVapidPublicKey && configuredVapidPrivateKey);
const generatedVapidKeys = hasConfiguredVapidKeys
  ? null
  : webpush.generateVAPIDKeys();
const VAPID_PUBLIC_KEY = hasConfiguredVapidKeys ? configuredVapidPublicKey : generatedVapidKeys.publicKey;
const VAPID_PRIVATE_KEY = hasConfiguredVapidKeys ? configuredVapidPrivateKey : generatedVapidKeys.privateKey;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const parsedPushCheckInterval = Number(process.env.PUSH_CHECK_INTERVAL_MINUTES || 60);
const PUSH_CHECK_INTERVAL_MINUTES = Number.isFinite(parsedPushCheckInterval) && parsedPushCheckInterval > 0
  ? parsedPushCheckInterval
  : 60;
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const BODY_LIMIT = process.env.BODY_LIMIT || '1mb';
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB || 10);
const AUTH_WINDOW_MS = Number(process.env.AUTH_WINDOW_MS || 15 * 60 * 1000);
const AUTH_MAX_REQUESTS = Number(process.env.AUTH_MAX_REQUESTS || 30);
const ALLOWED_BUCKETS = ['receipts', 'invoice-attachments', 'logos'];
const PUBLIC_APP_SETTING_KEYS = new Set(['registration_enabled', 'environment_mode']);
const HIDDEN_CONFIG_CHARS = /[\u0000-\u001F\u007F\u200B-\u200D\u2060\uFEFF\uFFFD]/g;
const cleanConfigValue = (value = '') => String(value).replace(HIDDEN_CONFIG_CHARS, '').trim();
const RABO_MODE = cleanConfigValue(process.env.RABO_MODE || 'premium').toLowerCase();
const RABO_CLIENT_ID = cleanConfigValue(process.env.RABO_CLIENT_ID);
const RABO_CLIENT_SECRET = cleanConfigValue(process.env.RABO_CLIENT_SECRET);
const RABO_SCOPES = cleanConfigValue(process.env.RABO_SCOPES);
const PUBLIC_BASE_URL = cleanConfigValue(PUBLIC_URL).replace(/\/$/, '');
const RABO_REDIRECT_URI = cleanConfigValue(
  process.env.RABO_REDIRECT_URI || `${PUBLIC_BASE_URL}/api/rabobank/callback`
);
const RABO_OAUTH_BASE_URL = (
  cleanConfigValue(process.env.RABO_OAUTH_BASE_URL) ||
  (RABO_MODE === 'psd2'
    ? 'https://oauth.rabobank.nl/openapi/oauth2'
    : 'https://oauth.rabobank.nl/openapi/oauth2-premium')
).replace(/\/$/, '');
const RABO_NOTIFICATION_PUSH_URI = (
  cleanConfigValue(process.env.RABO_NOTIFICATION_PUSH_URI) ||
  `${PUBLIC_BASE_URL}/api/rabobank/notifications`
);
const RABO_TOKEN_ENCRYPTION_SECRET = (
  process.env.RABO_TOKEN_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  process.env.JWT_REFRESH_SECRET ||
  'local-rabobank-token-development-secret'
).trim();

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

if (!hasConfiguredVapidKeys) {
  console.warn('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set. Using temporary push keys for this server process.');
}

const PROFILE_UPDATABLE_FIELDS = [
  'company_name',
  'company_address',
  'company_postal_code',
  'company_city',
  'company_country',
  'kvk_number',
  'btw_number',
  'iban',
  'default_hourly_rate',
  'default_payment_terms',
  'logo_url',
  'use_company_branding',
  'invoice_color_theme',
  'panel_color_theme',
  'payment_name',
  'invoice_email_subject_template',
  'invoice_email_body_template',
];

const CLIENT_UPDATABLE_FIELDS = [
  'company_name',
  'contact_name',
  'email',
  'phone',
  'address',
  'postal_code',
  'city',
  'country',
  'kvk_number',
  'btw_number',
  'notes',
  'is_saved',
];

const INVOICE_UPDATABLE_FIELDS = [
  'client_id',
  'invoice_number',
  'invoice_date',
  'due_date',
  'status',
  'subtotal',
  'total_btw',
  'total',
  'discount_type',
  'discount_value',
  'discount_amount',
  'notes',
  'notes_title',
  'payment_reference',
  'paid_at',
  'client_company_name',
  'client_contact_name',
  'client_address',
  'client_postal_code',
  'client_city',
  'client_country',
  'client_kvk_number',
  'client_btw_number',
];

const INVOICE_ITEM_UPDATABLE_FIELDS = [
  'description',
  'quantity',
  'unit',
  'unit_price',
  'btw_percentage',
  'subtotal',
  'btw_amount',
  'total',
  'discount_type',
  'discount_value',
  'sort_order',
];

const EXPENSE_UPDATABLE_FIELDS = [
  'vendor_name',
  'description',
  'category',
  'expense_date',
  'amount_excl_btw',
  'btw_amount',
  'amount_incl_btw',
  'btw_percentage',
  'btw_period',
  'receipt_url',
  'notes',
  'has_reverse_charge',
  'reverse_charge_type',
];

const OTHER_INCOME_UPDATABLE_FIELDS = [
  'source_name',
  'description',
  'category',
  'income_date',
  'amount',
  'notes',
];

const SUBSCRIPTION_UPDATABLE_FIELDS = [
  'client_id',
  'client_name',
  'service_name',
  'plan_name',
  'billing_interval_months',
  'monthly_price',
  'invoice_amount',
  'btw_percentage',
  'start_date',
  'next_invoice_date',
  'last_invoice_date',
  'minimum_term_months',
  'status',
  'notes',
];

const SUBSCRIPTION_PLAN_UPDATABLE_FIELDS = [
  'name',
  'billing_interval_months',
  'monthly_price',
  'invoice_amount',
  'minimum_term_months',
  'is_active',
  'sort_order',
];

const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: 'Vevuno Flex',
    billing_interval_months: 1,
    monthly_price: 70,
    invoice_amount: 70,
    minimum_term_months: 1,
    sort_order: 0,
  },
  {
    name: 'Vevuno 3',
    billing_interval_months: 3,
    monthly_price: 65,
    invoice_amount: 195,
    minimum_term_months: 3,
    sort_order: 1,
  },
  {
    name: 'Vevuno 6',
    billing_interval_months: 6,
    monthly_price: 60,
    invoice_amount: 360,
    minimum_term_months: 6,
    sort_order: 2,
  },
  {
    name: 'Vevuno 12',
    billing_interval_months: 12,
    monthly_price: 50,
    invoice_amount: 600,
    minimum_term_months: 12,
    sort_order: 3,
  },
];

const PROJECT_UPDATABLE_FIELDS = [
  'client_id',
  'client_name',
  'name',
  'description',
  'start_date',
  'end_date',
  'hourly_rate',
  'status',
];

const TIME_ENTRY_UPDATABLE_FIELDS = [
  'project_id',
  'work_date',
  'hours',
  'start_time',
  'end_time',
  'is_overnight',
  'description',
];

const BTW_PERIOD_UPDATABLE_FIELDS = [
  'period',
  'year',
  'quarter',
  'is_closed',
  'submitted_at',
  'closed_at',
  'notes',
];

const BUSINESS_ASSET_UPDATABLE_FIELDS = [
  'name',
  'purchase_date',
  'purchase_price',
  'residual_value',
  'useful_life_years',
  'category',
  'is_active',
  'notes',
];

const LABEL_UPDATABLE_FIELDS = [
  'name',
  'color',
];

const CALENDAR_EVENT_UPDATABLE_FIELDS = [
  'label_id',
  'title',
  'description',
  'start_time',
  'end_time',
  'all_day',
  'location',
  'external_id',
  'external_feed_id',
];

const DEFAULT_INVOICE_EMAIL_SUBJECT = 'Factuur {factuurnummer}';
const DEFAULT_INVOICE_EMAIL_BODY = `Beste {klantnaam},

Hierbij ontvang je factuur {factuurnummer}.

Factuurdatum: {factuurdatum}
Vervaldatum: {vervaldatum}
Totaalbedrag: {totaalbedrag}

Met vriendelijke groet,
{bedrijfsnaam}`;

const BTW_FILING_TURNOVER_FIELDS = [
  'turnover_1a',
  'turnover_1b',
  'turnover_1c',
  'turnover_1e',
  'turnover_2a',
  'turnover_3a',
  'turnover_3b',
  'turnover_3c',
  'turnover_4a',
  'turnover_4b',
];

const BTW_FILING_VAT_FIELDS = [
  'field_1a',
  'field_1b',
  'field_1c',
  'field_1d',
  'field_1e',
  'field_2a',
  'field_3a',
  'field_3b',
  'field_3c',
  'field_4a',
  'field_4b',
  'field_5a',
  'field_5b',
  'field_5c',
];

const BTW_FILING_AMOUNT_FIELDS = [
  ...BTW_FILING_TURNOVER_FIELDS,
  ...BTW_FILING_VAT_FIELDS,
];

const BTW_FILING_UPDATABLE_FIELDS = [
  'period',
  'year',
  'quarter',
  ...BTW_FILING_AMOUNT_FIELDS,
  'submitted',
  'submitted_at',
  'notes',
];

const parsedAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsAllowAll = parsedAllowedOrigins.length === 0 || parsedAllowedOrigins.includes('*');

// Middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (corsAllowAll || !origin || parsedAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
}));
app.use(express.json({ limit: BODY_LIMIT }));
app.use('/uploads', express.static(UPLOAD_ROOT));

const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

ALLOWED_BUCKETS.forEach((bucket) => {
  const bucketDir = path.join(UPLOAD_ROOT, bucket);
  if (!fs.existsSync(bucketDir)) {
    fs.mkdirSync(bucketDir, { recursive: true });
  }
});
const TEMP_DIR = path.join(UPLOAD_ROOT, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to temp first, because in multipart/form-data the 'file' 
    // might come before text fields like 'bucket', making req.body.bucket undefined here.
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const uploadWithLimits = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }

    cb(null, true);
  },
});

const invoiceEmailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Invoice attachment must be a PDF'));
    }

    cb(null, true);
  },
});

function handleInvoiceEmailUpload(req, res, next) {
  invoiceEmailUpload.single('invoicePdf')(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Invoice PDF must be smaller than ${UPLOAD_MAX_MB}MB` });
    }

    return res.status(400).json({ error: err.message || 'Invalid invoice PDF attachment' });
  });
}

async function getSetting(key, fallback = null) {
  const result = await pool.query(
    'SELECT setting_value FROM public.app_settings WHERE setting_key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    return fallback;
  }

  return result.rows[0].setting_value;
}

async function isAdmin(userId) {
  const result = await pool.query(
    'SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = $2 LIMIT 1',
    [userId, 'admin']
  );
  return result.rows.length > 0;
}

async function requireAdmin(req, res, next) {
  try {
    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: 'Admin rights required' });
    }
    next();
  } catch (err) {
    console.error('Admin check failed:', err);
    res.status(500).json({ error: 'Failed to validate admin rights' });
  }
}

function getRaboMissingConfig() {
  return [
    ['RABO_CLIENT_ID', RABO_CLIENT_ID],
    ['RABO_CLIENT_SECRET', RABO_CLIENT_SECRET],
    ['RABO_SCOPES', RABO_SCOPES],
    ['RABO_REDIRECT_URI', RABO_REDIRECT_URI],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function validateRaboHttpUrl(name, value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return `${name} must use http or https`;
    }
    return null;
  } catch (err) {
    return `${name} must be a valid URL`;
  }
}

function getRaboConfigErrors() {
  const errors = [];

  if (!['premium', 'psd2'].includes(RABO_MODE)) {
    errors.push('RABO_MODE must be premium or psd2');
  }

  [
    ['RABO_REDIRECT_URI', RABO_REDIRECT_URI],
    ['RABO_OAUTH_BASE_URL', RABO_OAUTH_BASE_URL],
    ['RABO_NOTIFICATION_PUSH_URI', RABO_NOTIFICATION_PUSH_URI],
  ].forEach(([name, value]) => {
    const error = validateRaboHttpUrl(name, value);
    if (error) errors.push(error);
  });

  return errors;
}

function isRaboConfigured() {
  return getRaboMissingConfig().length === 0 && getRaboConfigErrors().length === 0;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getRaboEncryptionKey() {
  return crypto.createHash('sha256').update(RABO_TOKEN_ENCRYPTION_SECRET).digest();
}

function encryptRaboToken(value) {
  if (!value) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getRaboEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function getRaboPublicStatus(connection = null, lastNotification = null) {
  const missing = getRaboMissingConfig();
  const configErrors = getRaboConfigErrors();

  return {
    configured: missing.length === 0 && configErrors.length === 0,
    missing,
    configErrors,
    mode: RABO_MODE === 'psd2' ? 'psd2' : 'premium',
    scopes: RABO_SCOPES,
    redirectUri: RABO_REDIRECT_URI,
    notificationPushUri: RABO_NOTIFICATION_PUSH_URI,
    connected: Boolean(connection),
    connection: connection
      ? {
          status: connection.status,
          scope: connection.scope,
          consentedOn: connection.consented_on,
          accessTokenExpiresAt: connection.access_token_expires_at,
          refreshTokenExpiresAt: connection.refresh_token_expires_at,
          updatedAt: connection.updated_at,
        }
      : null,
    lastNotification: lastNotification
      ? {
          notificationId: lastNotification.notification_id,
          subscriptionId: lastNotification.subscription_id,
          notificationType: lastNotification.notification_type,
          createdAt: lastNotification.created_at,
          processedAt: lastNotification.processed_at,
        }
      : null,
  };
}

async function exchangeRaboAuthorizationCode(code) {
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
  });

  if (RABO_REDIRECT_URI) {
    tokenBody.set('redirect_uri', RABO_REDIRECT_URI);
  }

  const tokenResponse = await fetch(`${RABO_OAUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${RABO_CLIENT_ID}:${RABO_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody,
  });

  const responseText = await tokenResponse.text();
  let tokenData;
  try {
    tokenData = responseText ? JSON.parse(responseText) : {};
  } catch (err) {
    tokenData = { raw: responseText };
  }

  if (!tokenResponse.ok) {
    const error = new Error('Rabobank token exchange failed');
    error.status = tokenResponse.status;
    error.details = tokenData;
    throw error;
  }

  return tokenData;
}

function addSecondsToNow(seconds) {
  const parsedSeconds = Number(seconds);
  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) return null;
  return new Date(Date.now() + parsedSeconds * 1000).toISOString();
}

let overduePushCheckRunning = false;
let queuedOverduePushCheck = null;

function buildOverdueInvoicePayload(invoice) {
  const clientName = invoice.client_company_name || invoice.client_contact_name || 'Onbekende klant';
  const amount = Number(invoice.total || 0).toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  });

  return {
    title: 'Factuur over betalingstermijn',
    body: `${invoice.invoice_number || 'Factuur'} voor ${clientName} staat nog op verzonden (${amount}).`,
    tag: `invoice-overdue-${invoice.id}`,
    url: `/invoices/${invoice.id}`,
    icon: '/pwa-icon.svg',
    badge: '/favicon.svg',
  };
}

async function sendPushNotification(subscriptionRow, payload) {
  try {
    await webpush.sendNotification(subscriptionRow.subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    const statusCode = err?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await pool.query(
        'DELETE FROM public.push_subscriptions WHERE id = $1',
        [subscriptionRow.subscription_id || subscriptionRow.id]
      );
      return false;
    }

    console.error('Error sending push notification:', err);
    return false;
  }
}

async function sendOverdueInvoicePushNotifications() {
  if (overduePushCheckRunning) return;
  overduePushCheckRunning = true;

  try {
    const result = await pool.query(`
      SELECT
        ps.id AS subscription_id,
        ps.user_id,
        ps.subscription,
        i.id,
        i.invoice_number,
        i.client_company_name,
        i.client_contact_name,
        i.total,
        i.due_date
      FROM public.push_subscriptions ps
      JOIN public.invoices i ON i.user_id = ps.user_id
      LEFT JOIN public.invoice_push_notifications_sent sent
        ON sent.invoice_id = i.id
       AND sent.push_subscription_id = ps.id
      WHERE ps.overdue_invoice_reminders_enabled = true
        AND i.status = 'sent'
        AND i.due_date < CURRENT_DATE
        AND sent.id IS NULL
      ORDER BY i.due_date ASC
      LIMIT 200
    `);

    for (const row of result.rows) {
      const sent = await sendPushNotification(row, buildOverdueInvoicePayload(row));
      if (sent) {
        await pool.query(
          `INSERT INTO public.invoice_push_notifications_sent (user_id, invoice_id, push_subscription_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (invoice_id, push_subscription_id) DO NOTHING`,
          [row.user_id, row.id, row.subscription_id]
        );
      }
    }
  } catch (err) {
    console.error('Error checking overdue invoice push notifications:', err);
  } finally {
    overduePushCheckRunning = false;
  }
}

function queueOverdueInvoiceCheck(delayMs = 5000) {
  if (queuedOverduePushCheck) return;
  queuedOverduePushCheck = setTimeout(() => {
    queuedOverduePushCheck = null;
    sendOverdueInvoicePushNotifications();
  }, delayMs);
}

function buildValidatedUpdate(body, allowedFields) {
  const requestedFields = Object.keys(body || {});

  if (requestedFields.length === 0) {
    return { error: 'No fields to update' };
  }

  const invalidFields = requestedFields.filter((field) => !allowedFields.includes(field));
  if (invalidFields.length > 0) {
    return { error: `Invalid update fields: ${invalidFields.join(', ')}` };
  }

  const values = requestedFields.map((field) => body[field]);
  const setClause = requestedFields.map((field, i) => `${field} = $${i + 1}`).join(', ');
  return { fields: requestedFields, values, setClause };
}

async function ensureDefaultSubscriptionPlans(userId) {
  const existingPlans = await pool.query(
    'SELECT id FROM public.subscription_plans WHERE user_id = $1 LIMIT 1',
    [userId]
  );

  if (existingPlans.rows.length > 0) {
    return;
  }

  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    await pool.query(
      `INSERT INTO public.subscription_plans (
          user_id,
          name,
          billing_interval_months,
          monthly_price,
          invoice_amount,
          minimum_term_months,
          sort_order
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        plan.name,
        plan.billing_interval_months,
        plan.monthly_price,
        plan.invoice_amount,
        plan.minimum_term_months,
        plan.sort_order,
      ]
    );
  }
}

function formatInvoiceEmailDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatInvoiceEmailCurrency(value) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));
}

function buildInvoiceEmailVariables(invoice, profile, recipientName, fallbackCompanyName) {
  const contactName = recipientName || invoice.client_contact_name || '';
  const clientName = contactName || invoice.client_company_name || 'klant';

  return {
    factuurnummer: invoice.invoice_number || '',
    factuurdatum: formatInvoiceEmailDate(invoice.invoice_date),
    vervaldatum: formatInvoiceEmailDate(invoice.due_date),
    totaalbedrag: formatInvoiceEmailCurrency(invoice.total),
    klantnaam: clientName,
    contactnaam: contactName,
    bedrijfsnaam: profile?.company_name || fallbackCompanyName || 'Easy Invoice Hub',
    iban: profile?.iban || '',
    betaalreferentie: invoice.payment_reference || invoice.invoice_number || '',
  };
}

function renderInvoiceEmailTemplate(template, variables) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

// ============================================
// Authentication Routes
// ============================================

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const registrationEnabled = await getSetting('registration_enabled', true);
    if (registrationEnabled === false) {
      return res.status(403).json({ error: 'Registration is disabled by administrator' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);
    const userId = randomUUID();

    // Create user and profile in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create user
      await client.query(
        'INSERT INTO public.users (id, email, password_hash) VALUES ($1, $2, $3)',
        [userId, email, hashedPassword]
      );

      // Create profile
      await client.query(
        'INSERT INTO public.profiles (user_id) VALUES ($1)',
        [userId]
      );

      // Make first user an admin
      const roleCount = await client.query('SELECT COUNT(*) FROM public.user_roles');
      const role = roleCount.rows[0].count === '0' ? 'admin' : 'user';
      await client.query(
        'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)',
        [userId, role]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { accessToken, refreshToken } = createTokens(userId, 0);
    setAuthCookies(req, res, accessToken, refreshToken);
    res.json({ accessToken, refreshToken, userId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, password_hash,
              COALESCE(token_version, 0) AS token_version,
              COALESCE(failed_login_attempts, 0) AS failed_login_attempts,
              locked_until
       FROM public.users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account tijdelijk vergrendeld. Probeer later opnieuw.' });
    }

    const validPassword = await bcryptjs.compare(password, user.password_hash);

    if (!validPassword) {
      await pool.query(
        `UPDATE public.users
         SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
             last_failed_login_at = NOW(),
             locked_until = CASE
               WHEN COALESCE(failed_login_attempts, 0) + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
               ELSE locked_until
             END,
             token_version = CASE
               WHEN COALESCE(failed_login_attempts, 0) + 1 >= 5 THEN COALESCE(token_version, 0) + 1
               ELSE COALESCE(token_version, 0)
             END
         WHERE id = $1`,
        [user.id]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query(
      `UPDATE public.users
       SET failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [user.id]
    );

    const { accessToken, refreshToken } = createTokens(user.id, Number(user.token_version || 0));
    setAuthCookies(req, res, accessToken, refreshToken);
    res.json({ accessToken, refreshToken, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
app.post('/api/auth/refresh', authLimiter, (req, res) => {
  const refreshToken = req.body?.refreshToken || getRefreshTokenFromRequest(req);

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
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

      const { accessToken, refreshToken: newRefreshToken } = createTokens(decoded.userId, currentVersion);
      setAuthCookies(req, res, accessToken, newRefreshToken);
      return res.json({ accessToken, refreshToken: newRefreshToken });
    })
    .catch((err) => {
      console.error('Refresh error:', err);
      return res.status(500).json({ error: 'Refresh failed' });
    });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookies(req, res);
  res.json({ success: true });
});

// Verify token
app.post('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ userId: req.userId });
});

// OAuth callback placeholder for self-hosted mode
app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing callback code' });
  }

  return res.status(501).json({ error: 'External OAuth callback is not configured on this server' });
});

// ============================================
// Rabobank Connection Routes
// ============================================

app.get('/api/rabobank/status', authenticateToken, async (req, res) => {
  try {
    const connectionResult = await pool.query(
      `SELECT status, scope, consented_on, access_token_expires_at, refresh_token_expires_at, updated_at
       FROM public.rabobank_connections
       WHERE user_id = $1
       LIMIT 1`,
      [req.userId]
    );
    const notificationResult = await pool.query(
      `SELECT notification_id, subscription_id, notification_type, created_at, processed_at
       FROM public.rabobank_notifications
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.userId]
    );

    res.json(getRaboPublicStatus(connectionResult.rows[0] || null, notificationResult.rows[0] || null));
  } catch (err) {
    console.error('Error fetching Rabobank status:', err);
    res.status(500).json({ error: 'Failed to fetch Rabobank status' });
  }
});

app.post('/api/rabobank/connect', authenticateToken, async (req, res) => {
  if (!isRaboConfigured()) {
    return res.status(400).json({
      error: 'Rabobank integration is not configured',
      missing: getRaboMissingConfig(),
      configErrors: getRaboConfigErrors(),
    });
  }

  try {
    const state = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO public.rabobank_oauth_states (user_id, state_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [req.userId, hashValue(state)]
    );

    const authorizationUrl = new URL(`${RABO_OAUTH_BASE_URL}/authorize`);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', RABO_SCOPES);
    authorizationUrl.searchParams.set('client_id', RABO_CLIENT_ID);
    authorizationUrl.searchParams.set('state', state);
    if (RABO_REDIRECT_URI) {
      authorizationUrl.searchParams.set('redirect_uri', RABO_REDIRECT_URI);
    }

    res.json({ authorizationUrl: authorizationUrl.toString() });
  } catch (err) {
    console.error('Error creating Rabobank authorization URL:', err);
    res.status(500).json({ error: 'Failed to start Rabobank authorization' });
  }
});

app.get('/api/rabobank/callback', async (req, res) => {
  const redirectBase = PUBLIC_URL.replace(/\/$/, '');
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${redirectBase}/payments?rabobank=denied`);
  }

  if (!code || !state) {
    return res.redirect(`${redirectBase}/payments?rabobank=invalid_callback`);
  }

  try {
    const stateResult = await pool.query(
      `DELETE FROM public.rabobank_oauth_states
       WHERE state_hash = $1
         AND expires_at > NOW()
       RETURNING user_id`,
      [hashValue(String(state))]
    );

    if (stateResult.rows.length === 0) {
      return res.redirect(`${redirectBase}/payments?rabobank=invalid_state`);
    }

    const userId = stateResult.rows[0].user_id;
    const tokenData = await exchangeRaboAuthorizationCode(String(code));
    const consentedOn = tokenData.consented_on
      ? new Date(Number(tokenData.consented_on) * 1000).toISOString()
      : new Date().toISOString();

    await pool.query(
      `INSERT INTO public.rabobank_connections (
          user_id,
          environment,
          scope,
          token_type,
          access_token_encrypted,
          access_token_expires_at,
          refresh_token_encrypted,
          refresh_token_expires_at,
          consented_on,
          metadata,
          status,
          updated_at
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'connected', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
          environment = EXCLUDED.environment,
          scope = EXCLUDED.scope,
          token_type = EXCLUDED.token_type,
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          access_token_expires_at = EXCLUDED.access_token_expires_at,
          refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
          refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
          consented_on = EXCLUDED.consented_on,
          metadata = EXCLUDED.metadata,
          status = 'connected',
          updated_at = NOW()`,
      [
        userId,
        RABO_MODE === 'psd2' ? 'psd2' : 'premium',
        tokenData.scope || RABO_SCOPES,
        tokenData.token_type || 'bearer',
        encryptRaboToken(tokenData.access_token),
        addSecondsToNow(tokenData.expires_in),
        encryptRaboToken(tokenData.refresh_token),
        addSecondsToNow(tokenData.refresh_token_expires_in),
        consentedOn,
        tokenData.metadata || null,
      ]
    );

    res.redirect(`${redirectBase}/payments?rabobank=connected`);
  } catch (err) {
    console.error('Rabobank OAuth callback failed:', err);
    res.redirect(`${redirectBase}/payments?rabobank=token_failed`);
  }
});

app.delete('/api/rabobank/connection', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.rabobank_connections WHERE user_id = $1', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error disconnecting Rabobank:', err);
    res.status(500).json({ error: 'Failed to disconnect Rabobank' });
  }
});

app.post('/api/rabobank/notifications', async (req, res) => {
  const payload = req.body || {};

  try {
    await pool.query(
      `INSERT INTO public.rabobank_notifications (
          notification_id,
          subscription_id,
          notification_type,
          payload
        )
       VALUES ($1, $2, $3, $4)`,
      [
        payload.notificationId || null,
        payload.subscriptionId || null,
        payload.notificationType || null,
        payload,
      ]
    );

    res.status(202).json({ received: true });
  } catch (err) {
    console.error('Error storing Rabobank notification:', err);
    res.status(500).json({ error: 'Failed to store Rabobank notification' });
  }
});

// ============================================
// Profile Routes
// ============================================

// Get profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.profiles WHERE user_id = $1', [req.userId]);
    const profile = result.rows[0];
    res.json(profile);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  const updatePayload = buildValidatedUpdate(req.body, PROFILE_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);

  try {
    const result = await pool.query(
      `UPDATE public.profiles SET ${setClause} WHERE user_id = $${fields.length + 1} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// Clients Routes
// ============================================

// Get all clients
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.clients WHERE user_id = $1 AND is_saved = true ORDER BY company_name',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Create client
app.post('/api/clients', authenticateToken, async (req, res) => {
  const { company_name, contact_name, email, phone, address, postal_code, city, country, kvk_number, btw_number, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.clients (user_id, company_name, contact_name, email, phone, address, postal_code, city, country, kvk_number, btw_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [req.userId, company_name, contact_name, email, phone, address, postal_code, city, country, kvk_number, btw_number, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, CLIENT_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.clients SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.clients WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ============================================
// Invoices Routes
// ============================================

// Get all invoices
app.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.invoices WHERE user_id = $1 ORDER BY invoice_number DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get invoice detail with items
app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoice = await pool.query(
      'SELECT * FROM public.invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (invoice.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const items = await pool.query(
      'SELECT * FROM public.invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
      [req.params.id]
    );

    res.json({ ...invoice.rows[0], items: items.rows });
  } catch (err) {
    console.error('Error fetching invoice:', err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice
app.post('/api/invoices', authenticateToken, async (req, res) => {
  const { client_id, invoice_number, invoice_date, due_date, status, subtotal, total_btw, total, discount_type, discount_value, discount_amount, notes, notes_title, payment_reference, client_company_name, client_contact_name, client_address, client_postal_code, client_city, client_country, client_kvk_number, client_btw_number } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.invoices (user_id, client_id, invoice_number, invoice_date, due_date, status, subtotal, total_btw, total, discount_type, discount_value, discount_amount, notes, notes_title, payment_reference, client_company_name, client_contact_name, client_address, client_postal_code, client_city, client_country, client_kvk_number, client_btw_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING *`,
      [req.userId, client_id, invoice_number, invoice_date, due_date, status, subtotal, total_btw, total, discount_type, discount_value, discount_amount, notes, notes_title, payment_reference, client_company_name, client_contact_name, client_address, client_postal_code, client_city, client_country, client_kvk_number, client_btw_number]
    );
    queueOverdueInvoiceCheck();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
app.put('/api/invoices/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, INVOICE_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.invoices SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    queueOverdueInvoiceCheck();
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.invoices WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting invoice:', err);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// ============================================
// Invoice Items Routes
// ============================================

// Add invoice item
app.post('/api/invoice-items', authenticateToken, async (req, res) => {
  const { invoice_id, description, quantity, unit, unit_price, btw_percentage, subtotal, btw_amount, total, discount_type, discount_value, sort_order } = req.body;

  try {
    // Verify invoice belongs to user
    const invoice = await pool.query(
      'SELECT id FROM public.invoices WHERE id = $1 AND user_id = $2',
      [invoice_id, req.userId]
    );
    if (invoice.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query(
      `INSERT INTO public.invoice_items (invoice_id, description, quantity, unit, unit_price, btw_percentage, subtotal, btw_amount, total, discount_type, discount_value, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [invoice_id, description, quantity, unit, unit_price, btw_percentage, subtotal, btw_amount, total, discount_type, discount_value, sort_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating invoice item:', err);
    res.status(500).json({ error: 'Failed to create invoice item' });
  }
});

// Update invoice item
app.put('/api/invoice-items/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, INVOICE_ITEM_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(id);

  try {
    // Verify item exists and belongs to user's invoice
    const item = await pool.query(
      'SELECT ii.id FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id = i.id WHERE ii.id = $1 AND i.user_id = $2',
      [id, req.userId]
    );
    if (item.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query(
      `UPDATE public.invoice_items SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating invoice item:', err);
    res.status(500).json({ error: 'Failed to update invoice item' });
  }
});

// Delete invoice item
app.delete('/api/invoice-items/:id', authenticateToken, async (req, res) => {
  try {
    const item = await pool.query(
      'SELECT ii.id FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id = i.id WHERE ii.id = $1 AND i.user_id = $2',
      [req.params.id, req.userId]
    );
    if (item.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

    await pool.query('DELETE FROM public.invoice_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting invoice item:', err);
    res.status(500).json({ error: 'Failed to delete invoice item' });
  }
});

// ============================================
// Expenses Routes
// ============================================

// Get expenses
app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.expenses WHERE user_id = $1 ORDER BY expense_date DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create expense
app.post('/api/expenses', authenticateToken, async (req, res) => {
  const { vendor_name, description, category, expense_date, amount_excl_btw, btw_amount, amount_incl_btw, btw_percentage, btw_period, receipt_url, notes, has_reverse_charge, reverse_charge_type } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.expenses (user_id, vendor_name, description, category, expense_date, amount_excl_btw, btw_amount, amount_incl_btw, btw_percentage, btw_period, receipt_url, notes, has_reverse_charge, reverse_charge_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [req.userId, vendor_name, description, category, expense_date, amount_excl_btw, btw_amount, amount_incl_btw, btw_percentage, btw_period, receipt_url, notes, has_reverse_charge ?? false, has_reverse_charge ? (reverse_charge_type || 'eu') : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, EXPENSE_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.expenses SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ============================================
// Other Income Routes
// ============================================

app.get('/api/other-income', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.other_income WHERE user_id = $1 ORDER BY income_date DESC, created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching other income:', err);
    res.status(500).json({ error: 'Failed to fetch other income' });
  }
});

app.post('/api/other-income', authenticateToken, async (req, res) => {
  const { source_name, description, category, income_date, amount, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.other_income (user_id, source_name, description, category, income_date, amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.userId, source_name, description, category, income_date, amount, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating other income:', err);
    res.status(500).json({ error: 'Failed to create other income' });
  }
});

app.put('/api/other-income/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, OTHER_INCOME_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.other_income SET ${setClause}, updated_at=NOW() WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Income not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating other income:', err);
    res.status(500).json({ error: 'Failed to update other income' });
  }
});

app.delete('/api/other-income/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.other_income WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Income not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting other income:', err);
    res.status(500).json({ error: 'Failed to delete other income' });
  }
});

// ============================================
// Subscription Plans Routes
// ============================================

app.get('/api/subscription-plans', authenticateToken, async (req, res) => {
  try {
    await ensureDefaultSubscriptionPlans(req.userId);
    const result = await pool.query(
      `SELECT * FROM public.subscription_plans
       WHERE user_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscription plans:', err);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

app.post('/api/subscription-plans', authenticateToken, async (req, res) => {
  const {
    name,
    billing_interval_months,
    monthly_price,
    invoice_amount,
    minimum_term_months,
    is_active,
    sort_order,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.subscription_plans (
          user_id,
          name,
          billing_interval_months,
          monthly_price,
          invoice_amount,
          minimum_term_months,
          is_active,
          sort_order
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.userId,
        name,
        billing_interval_months,
        monthly_price,
        invoice_amount,
        minimum_term_months,
        is_active ?? true,
        sort_order ?? 0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating subscription plan:', err);
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

app.put('/api/subscription-plans/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, SUBSCRIPTION_PLAN_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.subscription_plans SET ${setClause}, updated_at=NOW()
       WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription plan not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating subscription plan:', err);
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

app.delete('/api/subscription-plans/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE public.subscription_plans
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription plan not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting subscription plan:', err);
    res.status(500).json({ error: 'Failed to delete subscription plan' });
  }
});

// ============================================
// Subscriptions Routes
// ============================================

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.subscriptions
       WHERE user_id = $1
       ORDER BY
         CASE status
           WHEN 'active' THEN 0
           WHEN 'paused' THEN 1
           ELSE 2
         END,
         next_invoice_date ASC,
         created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

app.post('/api/subscriptions', authenticateToken, async (req, res) => {
  const {
    client_id,
    client_name,
    service_name,
    plan_name,
    billing_interval_months,
    monthly_price,
    invoice_amount,
    btw_percentage,
    start_date,
    next_invoice_date,
    last_invoice_date,
    minimum_term_months,
    status,
    notes,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.subscriptions (
          user_id,
          client_id,
          client_name,
          service_name,
          plan_name,
          billing_interval_months,
          monthly_price,
          invoice_amount,
          btw_percentage,
          start_date,
          next_invoice_date,
          last_invoice_date,
          minimum_term_months,
          status,
          notes
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.userId,
        client_id,
        client_name,
        service_name,
        plan_name,
        billing_interval_months,
        monthly_price,
        invoice_amount,
        btw_percentage,
        start_date,
        next_invoice_date,
        last_invoice_date,
        minimum_term_months,
        status || 'active',
        notes,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating subscription:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.put('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, SUBSCRIPTION_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.subscriptions SET ${setClause}, updated_at=NOW()
       WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

app.delete('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting subscription:', err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// ============================================
// Projects Routes
// ============================================

// Get projects
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.projects WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create project
app.post('/api/projects', authenticateToken, async (req, res) => {
  const { client_id, client_name, name, description, start_date, end_date, hourly_rate, status } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.projects (user_id, client_id, client_name, name, description, start_date, end_date, hourly_rate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.userId, client_id, client_name, name, description, start_date, end_date, hourly_rate, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, PROJECT_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.projects SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============================================
// Time Entries Routes
// ============================================

// Get time entries
app.get('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.time_entries WHERE user_id = $1 ORDER BY work_date DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching time entries:', err);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Create time entry
app.post('/api/time-entries', authenticateToken, async (req, res) => {
  const { project_id, work_date, hours, start_time, end_time, is_overnight, description } = req.body;

  try {
    // Verify project belongs to user
    const project = await pool.query(
      'SELECT id FROM public.projects WHERE id = $1 AND user_id = $2',
      [project_id, req.userId]
    );
    if (project.rows.length === 0) return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query(
      `INSERT INTO public.time_entries (user_id, project_id, work_date, hours, start_time, end_time, is_overnight, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, project_id, work_date, hours, start_time, end_time, is_overnight, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating time entry:', err);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// Update time entry
app.put('/api/time-entries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, TIME_ENTRY_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.time_entries SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Time entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating time entry:', err);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// Delete time entry
app.delete('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.time_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Time entry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting time entry:', err);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// ============================================
// BTW Periods Routes
// ============================================

// Get BTW periods
app.get('/api/btw-periods', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.btw_periods WHERE user_id = $1 ORDER BY year DESC, quarter DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching BTW periods:', err);
    res.status(500).json({ error: 'Failed to fetch BTW periods' });
  }
});

// Create BTW period
app.post('/api/btw-periods', authenticateToken, async (req, res) => {
  const { period, year, quarter, is_closed, submitted_at, closed_at, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.btw_periods (user_id, period, year, quarter, is_closed, submitted_at, closed_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, period, year, quarter, is_closed ?? false, submitted_at || null, closed_at || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating BTW period:', err);
    res.status(500).json({ error: 'Failed to create BTW period' });
  }
});

// Update BTW period
app.put('/api/btw-periods/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, BTW_PERIOD_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.btw_periods SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'BTW period not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating BTW period:', err);
    res.status(500).json({ error: 'Failed to update BTW period' });
  }
});

// ============================================
// Business Assets Routes
// ============================================

// Get business assets
app.get('/api/business-assets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.business_assets WHERE user_id = $1 ORDER BY purchase_date DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching business assets:', err);
    res.status(500).json({ error: 'Failed to fetch business assets' });
  }
});

// Create business asset
app.post('/api/business-assets', authenticateToken, async (req, res) => {
  const { name, purchase_date, purchase_price, residual_value, useful_life_years, category, is_active, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.business_assets (user_id, name, purchase_date, purchase_price, residual_value, useful_life_years, category, is_active, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.userId, name, purchase_date, purchase_price, residual_value, useful_life_years, category, is_active, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating business asset:', err);
    res.status(500).json({ error: 'Failed to create business asset' });
  }
});

// Update business asset
app.put('/api/business-assets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, BUSINESS_ASSET_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.business_assets SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business asset not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating business asset:', err);
    res.status(500).json({ error: 'Failed to update business asset' });
  }
});

// Delete business asset
app.delete('/api/business-assets/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.business_assets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Business asset not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting business asset:', err);
    res.status(500).json({ error: 'Failed to delete business asset' });
  }
});

// ============================================
// Annual Tax Data Routes
// ============================================

// Get annual tax data
app.get('/api/annual-tax-data', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.annual_tax_data WHERE user_id = $1 ORDER BY year DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching annual tax data:', err);
    res.status(500).json({ error: 'Failed to fetch annual tax data' });
  }
});

// Create/Update annual tax data
app.post('/api/annual-tax-data', authenticateToken, async (req, res) => {
  const { year, hours_worked, is_starter, vehicle_private_percentage, vehicle_total_km, vehicle_business_km, vehicle_costs, notes } = req.body;

  try {
    // Check if exists
    const existing = await pool.query(
      'SELECT id FROM public.annual_tax_data WHERE user_id = $1 AND year = $2',
      [req.userId, year]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE public.annual_tax_data SET hours_worked = $1, is_starter = $2, vehicle_private_percentage = $3, vehicle_total_km = $4, vehicle_business_km = $5, vehicle_costs = $6, notes = $7
         WHERE user_id = $8 AND year = $9
         RETURNING *`,
        [hours_worked, is_starter, vehicle_private_percentage, vehicle_total_km, vehicle_business_km, vehicle_costs, notes, req.userId, year]
      );
    } else {
      result = await pool.query(
        `INSERT INTO public.annual_tax_data (user_id, year, hours_worked, is_starter, vehicle_private_percentage, vehicle_total_km, vehicle_business_km, vehicle_costs, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [req.userId, year, hours_worked, is_starter, vehicle_private_percentage, vehicle_total_km, vehicle_business_km, vehicle_costs, notes]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving annual tax data:', err);
    res.status(500).json({ error: 'Failed to save annual tax data' });
  }
});

// ============================================
// Monthly Salary Routes
// ============================================

app.get('/api/monthly-salaries/:year', authenticateToken, async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year)) return res.status(400).json({ error: 'Invalid year' });

  try {
    const result = await pool.query(
      'SELECT * FROM public.monthly_salaries WHERE user_id = $1 AND year = $2 ORDER BY month',
      [req.userId, year]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching monthly salaries:', err);
    res.status(500).json({ error: 'Failed to fetch monthly salaries' });
  }
});

app.post('/api/monthly-salaries/bulk', authenticateToken, async (req, res) => {
  const salaries = Array.isArray(req.body.salaries) ? req.body.salaries : [];
  const salaryYears = new Set(salaries.map((salary) => Number(salary.year)));
  const salaryMonths = new Set(salaries.map((salary) => Number(salary.month)));
  if (salaries.length !== 12 || salaryYears.size !== 1 || salaryMonths.size !== 12 || ![...salaryMonths].every((month) => month >= 1 && month <= 12) || salaries.some((salary) => {
    const month = Number(salary.month);
    const amount = Number(salary.gross_amount);
    return !Number.isInteger(Number(salary.year)) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(amount) || amount < 0;
  })) {
    return res.status(400).json({ error: 'Invalid salary data' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const saved = [];
      for (const salary of salaries) {
        const result = await client.query(
          `INSERT INTO public.monthly_salaries (user_id, year, month, gross_amount)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, year, month) DO UPDATE SET gross_amount = EXCLUDED.gross_amount, updated_at = now()
           RETURNING *`,
          [req.userId, Number(salary.year), Number(salary.month), Number(salary.gross_amount)]
        );
        saved.push(result.rows[0]);
      }
      await client.query('COMMIT');
      res.json(saved);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error saving monthly salaries:', err);
    res.status(500).json({ error: 'Failed to save monthly salaries' });
  }
});

app.post('/api/monthly-salaries', authenticateToken, async (req, res) => {
  const year = Number(req.body.year);
  const month = Number(req.body.month);
  const grossAmount = Number(req.body.gross_amount);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(grossAmount) || grossAmount < 0) {
    return res.status(400).json({ error: 'Invalid salary data' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.monthly_salaries (user_id, year, month, gross_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, year, month) DO UPDATE SET gross_amount = EXCLUDED.gross_amount, updated_at = now()
       RETURNING *`,
      [req.userId, year, month, grossAmount]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving monthly salary:', err);
    res.status(500).json({ error: 'Failed to save monthly salary' });
  }
});

// ============================================
// App Settings & Roles Routes
// ============================================

app.get('/api/user-role', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.user_roles WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [req.userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Error fetching user role:', err);
    res.status(500).json({ error: 'Failed to fetch user role' });
  }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id,
              u.email,
              u.created_at,
              COALESCE(ur.role, 'user') AS role,
              p.company_name
       FROM public.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.id
       LEFT JOIN public.profiles p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing user id' });
  }

  if (id === req.userId) {
    return res.status(400).json({ error: 'Admins cannot delete their own account from this screen' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetRoleResult = await client.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [id]
    );

    const targetRole = targetRoleResult.rows[0]?.role || 'user';
    if (targetRole === 'admin') {
      const adminCountResult = await client.query(
        'SELECT COUNT(*)::int AS count FROM public.user_roles WHERE role = $1',
        ['admin']
      );
      const adminCount = Number(adminCountResult.rows[0]?.count || 0);
      if (adminCount <= 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
      }
    }

    const deleteResult = await client.query(
      'DELETE FROM public.users WHERE id = $1 RETURNING id',
      [id]
    );

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query('COMMIT');
    return res.json({ success: true, deletedUserId: id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting admin user:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

app.get('/api/app-settings', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.userId);
    const result = await pool.query(
      'SELECT setting_key, setting_value FROM public.app_settings ORDER BY setting_key ASC'
    );
    const rows = admin
      ? result.rows
      : result.rows.filter((row) => PUBLIC_APP_SETTING_KEYS.has(row.setting_key));

    res.json(rows);
  } catch (err) {
    console.error('Error fetching app settings:', err);
    res.status(500).json({ error: 'Failed to fetch app settings' });
  }
});

app.put('/api/app-settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.app_settings (setting_key, setting_value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value
       RETURNING setting_key, setting_value`,
      [key, JSON.stringify(value)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating app setting:', err);
    res.status(500).json({ error: 'Failed to update app setting' });
  }
});

app.put('/api/app-settings', authenticateToken, requireAdmin, async (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: 'Settings array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const setting of settings) {
      await client.query(
        `INSERT INTO public.app_settings (setting_key, setting_value)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [setting.key, JSON.stringify(setting.value)]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating app settings in bulk:', err);
    res.status(500).json({ error: 'Failed to update app settings' });
  } finally {
    client.release();
  }
});

// ============================================
// Push Notification Routes
// ============================================

app.get('/api/push/config', authenticateToken, async (req, res) => {
  res.json({
    enabled: Boolean(VAPID_PUBLIC_KEY),
    publicKey: VAPID_PUBLIC_KEY,
    persistentKeys: hasConfiguredVapidKeys,
    checkIntervalMinutes: PUSH_CHECK_INTERVAL_MINUTES,
  });
});

app.post('/api/push/subscriptions', authenticateToken, async (req, res) => {
  const { subscription } = req.body || {};

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Valid push subscription is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.push_subscriptions (user_id, endpoint, subscription, user_agent, overdue_invoice_reminders_enabled)
       VALUES ($1, $2, $3::jsonb, $4, true)
       ON CONFLICT (endpoint)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         subscription = EXCLUDED.subscription,
         user_agent = EXCLUDED.user_agent,
         overdue_invoice_reminders_enabled = true,
         last_seen_at = now(),
         updated_at = now()
       RETURNING id, endpoint, overdue_invoice_reminders_enabled`,
      [req.userId, subscription.endpoint, JSON.stringify(subscription), req.get('user-agent') || null]
    );

    queueOverdueInvoiceCheck();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

app.delete('/api/push/subscriptions', authenticateToken, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  try {
    await pool.query(
      'DELETE FROM public.push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.userId, endpoint]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting push subscription:', err);
    res.status(500).json({ error: 'Failed to delete push subscription' });
  }
});

app.post('/api/push/test', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, subscription
       FROM public.push_subscriptions
       WHERE user_id = $1
         AND overdue_invoice_reminders_enabled = true`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active push subscription found' });
    }

    let sentCount = 0;
    for (const row of result.rows) {
      const sent = await sendPushNotification(row, {
        title: 'MijnZaak testmelding',
        body: 'Pushmeldingen staan goed ingesteld op dit apparaat.',
        tag: 'push-test',
        url: '/settings',
        icon: '/pwa-icon.svg',
        badge: '/favicon.svg',
      });
      if (sent) sentCount += 1;
    }

    res.json({ success: true, sentCount });
  } catch (err) {
    console.error('Error sending test push notification:', err);
    res.status(500).json({ error: 'Failed to send test push notification' });
  }
});

// ============================================
// Calendar Routes
// ============================================

app.get('/api/labels', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM public.labels WHERE user_id = $1 ORDER BY is_system DESC, name ASC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching labels:', err);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

app.post('/api/labels', authenticateToken, async (req, res) => {
  const { name, color, is_system } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO public.labels (user_id, name, color, is_system)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.userId, name, color, Boolean(is_system)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating label:', err);
    res.status(500).json({ error: 'Failed to create label' });
  }
});

app.put('/api/labels/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, LABEL_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId, id);

  try {
    const result = await pool.query(
      `UPDATE public.labels
       SET ${setClause}
       WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Label not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating label:', err);
    res.status(500).json({ error: 'Failed to update label' });
  }
});

app.delete('/api/labels/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.labels WHERE id = $1 AND user_id = $2 AND is_system = false RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Label not found or protected' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting label:', err);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

app.get('/api/calendar-events', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, row_to_json(l) AS label
       FROM public.calendar_events e
       LEFT JOIN public.labels l ON l.id = e.label_id
       WHERE e.user_id = $1
       ORDER BY e.start_time ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

app.post('/api/calendar-events', authenticateToken, async (req, res) => {
  const { label_id, title, description, start_time, end_time, all_day, location, external_id, external_feed_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.calendar_events (user_id, label_id, title, description, start_time, end_time, all_day, location, external_id, external_feed_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.userId, label_id, title, description, start_time, end_time, Boolean(all_day), location, external_id, external_feed_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

app.put('/api/calendar-events/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, CALENDAR_EVENT_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId, id);

  try {
    const result = await pool.query(
      `UPDATE public.calendar_events
       SET ${setClause}
       WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

app.delete('/api/calendar-events/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.calendar_events WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar event not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting calendar event:', err);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

app.get('/api/external-feeds', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, row_to_json(l) AS label
       FROM public.external_feeds f
       LEFT JOIN public.labels l ON l.id = f.label_id
       WHERE f.user_id = $1
       ORDER BY f.name ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching external feeds:', err);
    res.status(500).json({ error: 'Failed to fetch external feeds' });
  }
});

app.post('/api/external-feeds', authenticateToken, async (req, res) => {
  const { label_id, name, url, last_synced_at, is_active } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.external_feeds (user_id, label_id, name, url, last_synced_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, label_id, name, url, last_synced_at, is_active ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating external feed:', err);
    res.status(500).json({ error: 'Failed to create external feed' });
  }
});

app.delete('/api/external-feeds/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM public.external_feeds WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'External feed not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting external feed:', err);
    res.status(500).json({ error: 'Failed to delete external feed' });
  }
});

function formatIcsDate(dateInput, allDay) {
  const date = new Date(dateInput);
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

app.get('/api/calendar/ical', async (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = req.query.access_token;
  const token = bearerToken || queryToken;

  if (!token) {
    return res.status(401).send('Unauthorized');
  }

  const decoded = verifyAccessToken(token);
  if (!decoded?.userId) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const result = await pool.query(
      'SELECT id, title, description, location, start_time, end_time, all_day, updated_at FROM public.calendar_events WHERE user_id = $1 ORDER BY start_time ASC',
      [decoded.userId]
    );

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Easy Invoice Hub//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const event of result.rows) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}@easy-invoice-hub`);
      lines.push(`DTSTAMP:${formatIcsDate(event.updated_at || new Date().toISOString(), false)}`);
      if (event.all_day) {
        lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(event.start_time, true)}`);
        lines.push(`DTEND;VALUE=DATE:${formatIcsDate(event.end_time, true)}`);
      } else {
        lines.push(`DTSTART:${formatIcsDate(event.start_time, false)}`);
        lines.push(`DTEND:${formatIcsDate(event.end_time, false)}`);
      }
      lines.push(`SUMMARY:${String(event.title || '').replace(/\n/g, ' ')}`);
      if (event.description) lines.push(`DESCRIPTION:${String(event.description).replace(/\n/g, ' ')}`);
      if (event.location) lines.push(`LOCATION:${String(event.location).replace(/\n/g, ' ')}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
    res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('Error generating iCal:', err);
    res.status(500).send('Failed to generate iCal');
  }
});

// ============================================
// File Upload Routes
// ============================================

app.post('/api/files/upload', authenticateToken, uploadWithLimits.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const bucket = req.body.bucket;
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ error: 'Invalid bucket' });
  }

  const targetDir = path.join(UPLOAD_ROOT, bucket);
  const targetPath = path.join(targetDir, req.file.filename);
  
  try {
    fs.renameSync(req.file.path, targetPath);
  } catch (err) {
    console.error('Failed to move uploaded file:', err);
    return res.status(500).json({ error: 'Failed to process uploaded file' });
  }

  const relativeUrl = `/uploads/${bucket}/${req.file.filename}`;
  return res.status(201).json({
    url: relativeUrl,
    absoluteUrl: `${PUBLIC_URL}${relativeUrl}`,
    path: relativeUrl,
    filename: req.file.filename,
    bucket,
  });
});

app.delete('/api/files', authenticateToken, async (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'Missing file path' });
  }

  try {
    const normalized = String(filePath);
    const relativePath = normalized.startsWith('http') ? new URL(normalized).pathname : normalized;
    if (!relativePath.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Invalid upload path' });
    }

    const safeRelativePath = relativePath.replace(/^\/uploads\//, '');
    const absolutePath = path.resolve(UPLOAD_ROOT, safeRelativePath);
    if (!absolutePath.startsWith(UPLOAD_ROOT + path.sep)) {
      return res.status(400).json({ error: 'Invalid upload path' });
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ============================================
// Invoice Email Route
// ============================================

app.post('/api/invoices/:id/send-email', authenticateToken, handleInvoiceEmailUpload, async (req, res) => {
  const { recipientEmail, recipientName, emailSubject, customMessage } = req.body;
  if (!recipientEmail) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  try {
    const invoiceResult = await pool.query(
      'SELECT * FROM public.invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    const profileResult = await pool.query(
      `SELECT company_name, iban, invoice_email_subject_template, invoice_email_body_template
       FROM public.profiles
       WHERE user_id = $1`,
      [req.userId]
    );
    const profile = profileResult.rows[0] || {};

    const smtpHost = await getSetting('smtp_host', '');
    const smtpPort = Number(await getSetting('smtp_port', 587));
    const smtpUser = await getSetting('smtp_user', '');
    const smtpPassword = await getSetting('smtp_password', '');
    const fromEmail = await getSetting('smtp_from_email', smtpUser || 'no-reply@localhost');
    const fromName = await getSetting('smtp_from_name', 'Easy Invoice Hub');

    if (!smtpHost) {
      return res.status(400).json({ error: 'SMTP is not configured. Set SMTP settings in admin panel.' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPassword } : undefined,
    });

    const variables = buildInvoiceEmailVariables(invoice, profile, recipientName, fromName);
    const subjectTemplate = Object.prototype.hasOwnProperty.call(req.body, 'emailSubject')
      ? emailSubject
      : profile.invoice_email_subject_template || DEFAULT_INVOICE_EMAIL_SUBJECT;
    const bodyTemplate = Object.prototype.hasOwnProperty.call(req.body, 'customMessage')
      ? customMessage
      : profile.invoice_email_body_template || DEFAULT_INVOICE_EMAIL_BODY;
    const subject = renderInvoiceEmailTemplate(subjectTemplate, variables).trim() || `Factuur ${invoice.invoice_number}`;
    const message = renderInvoiceEmailTemplate(bodyTemplate, variables);

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject,
      text: message,
      attachments: req.file
        ? [{
          filename: req.file.originalname || `Factuur-${invoice.invoice_number}.pdf`,
          content: req.file.buffer,
          contentType: 'application/pdf',
        }]
        : undefined,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error sending invoice email:', err);
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
});

// ============================================
// BTW Filing Fields Routes
// ============================================

// Get filing by period
app.get('/api/btw-filing-fields/:period', authenticateToken, async (req, res) => {
  const { period } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM public.btw_filing_fields WHERE user_id = $1 AND period = $2',
      [req.userId, period]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Error fetching BTW filing fields:', err);
    res.status(500).json({ error: 'Failed to fetch BTW filing fields' });
  }
});

// Get filing by year and quarter
app.get('/api/btw-filing-fields/year-quarter/:year/:quarter', authenticateToken, async (req, res) => {
  const { year, quarter } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM public.btw_filing_fields WHERE user_id = $1 AND year = $2 AND quarter = $3',
      [req.userId, parseInt(year), parseInt(quarter)]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Error fetching BTW filing fields:', err);
    res.status(500).json({ error: 'Failed to fetch BTW filing fields' });
  }
});

// Upsert filing fields
app.post('/api/btw-filing-fields', authenticateToken, async (req, res) => {
  const {
    period, year, quarter,
    submitted, submitted_at, notes
  } = req.body;
  const amountValues = BTW_FILING_AMOUNT_FIELDS.map((field) => req.body[field] ?? 0);
  const updateSetClause = BTW_FILING_AMOUNT_FIELDS
    .map((field, index) => `${field}=$${index + 2}`)
    .join(', ');
  const submittedIndex = amountValues.length + 2;
  const submittedAtIndex = amountValues.length + 3;
  const notesIndex = amountValues.length + 4;
  const periodIndex = amountValues.length + 5;
  const insertColumns = [
    'user_id',
    'period',
    'year',
    'quarter',
    ...BTW_FILING_AMOUNT_FIELDS,
    'submitted',
    'submitted_at',
    'notes',
  ];
  const insertPlaceholders = insertColumns
    .map((_, index) => `$${index + 1}`)
    .join(', ');

  try {
    // Try to update first
    const updateResult = await pool.query(
      `UPDATE public.btw_filing_fields 
       SET ${updateSetClause},
           submitted=$${submittedIndex}, submitted_at=$${submittedAtIndex}, notes=$${notesIndex}, updated_at=NOW()
       WHERE user_id=$1 AND period=$${periodIndex}
       RETURNING *`,
      [
        req.userId,
        ...amountValues,
        submitted ?? false,
        submitted_at ?? null,
        notes ?? null,
        period,
      ]
    );

    if (updateResult.rows.length > 0) {
      return res.json(updateResult.rows[0]);
    }

    // If not found, insert
    const insertResult = await pool.query(
      `INSERT INTO public.btw_filing_fields 
       (${insertColumns.join(', ')})
       VALUES (${insertPlaceholders})
       RETURNING *`,
      [
        req.userId,
        period,
        year,
        quarter,
        ...amountValues,
        submitted ?? false,
        submitted_at ?? null,
        notes ?? null,
      ]
    );
    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error('Error upserting BTW filing fields:', err);
    res.status(500).json({ error: 'Failed to save BTW filing fields' });
  }
});

// Update filing fields
app.put('/api/btw-filing-fields/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updatePayload = buildValidatedUpdate(req.body, BTW_FILING_UPDATABLE_FIELDS);
  if (updatePayload.error) {
    return res.status(400).json({ error: updatePayload.error });
  }

  const { fields, values, setClause } = updatePayload;
  values.push(req.userId);
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE public.btw_filing_fields SET ${setClause}, updated_at=NOW() WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'BTW filing not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating BTW filing fields:', err);
    res.status(500).json({ error: 'Failed to update BTW filing fields' });
  }
});

// Submit filing
app.post('/api/btw-filing-fields/:id/submit', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE public.btw_filing_fields 
       SET submitted=true, submitted_at=NOW(), updated_at=NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [req.userId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'BTW filing not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error submitting BTW filing:', err);
    res.status(500).json({ error: 'Failed to submit BTW filing' });
  }
});

// ============================================
// Health check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File is too large. Max ${UPLOAD_MAX_MB}MB.` });
  }

  if (err?.message === 'Unsupported file type' || err?.message === 'Invalid upload bucket') {
    return res.status(400).json({ error: err.message });
  }

  if (err?.message === 'CORS origin denied') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Unhandled API error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// Setup MFA and OAuth Routes
// ============================================
setupMFARoutes(app, pool, authenticateToken, createTokens, setAuthCookies);
setupOAuthRoutes(app, pool, authenticateToken, isAuthentikConfigured, getAuthorizationURL, handleOAuthCallback, createTokens, setAuthCookies);

// ============================================
// Start server
// ============================================
const ensureRuntimeSchema = async () => {
  // Keep runtime compatible even when a deployment missed the latest migration.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      subscription jsonb NOT NULL,
      user_agent text,
      overdue_invoice_reminders_enabled boolean NOT NULL DEFAULT true,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.invoice_push_notifications_sent (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
      push_subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
      sent_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(invoice_id, push_subscription_id)
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_invoice_push_sent_user_invoice ON public.invoice_push_notifications_sent (user_id, invoice_id)');

  await pool.query(`
    ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS has_reverse_charge boolean NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS reverse_charge_type text
  `);

  await pool.query(`
    UPDATE public.expenses
    SET reverse_charge_type = 'eu'
    WHERE has_reverse_charge = true
      AND reverse_charge_type IS NULL
  `);

  await pool.query(`
    ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS paid_at timestamptz
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.rabobank_connections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
      environment text NOT NULL DEFAULT 'premium',
      scope text,
      token_type text,
      access_token_encrypted text,
      access_token_expires_at timestamptz,
      refresh_token_encrypted text,
      refresh_token_expires_at timestamptz,
      consented_on timestamptz,
      metadata text,
      status text NOT NULL DEFAULT 'connected',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.rabobank_oauth_states (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      state_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.rabobank_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      notification_id text,
      subscription_id text,
      notification_type text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      processed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_rabobank_connections_user_id ON public.rabobank_connections (user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_rabobank_oauth_states_hash ON public.rabobank_oauth_states (state_hash)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_rabobank_notifications_user_created ON public.rabobank_notifications (user_id, created_at DESC)');

  await pool.query(`
    ALTER TABLE public.btw_periods
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz
  `);

  await pool.query(`
    ALTER TABLE public.btw_periods
    ADD COLUMN IF NOT EXISTS closed_at timestamptz
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.btw_filing_fields (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      period text NOT NULL,
      year integer NOT NULL,
      quarter integer NOT NULL,
      turnover_1a numeric(14,2) DEFAULT 0,
      turnover_1b numeric(14,2) DEFAULT 0,
      turnover_1c numeric(14,2) DEFAULT 0,
      turnover_1e numeric(14,2) DEFAULT 0,
      turnover_2a numeric(14,2) DEFAULT 0,
      turnover_3a numeric(14,2) DEFAULT 0,
      turnover_3b numeric(14,2) DEFAULT 0,
      turnover_3c numeric(14,2) DEFAULT 0,
      turnover_4a numeric(14,2) DEFAULT 0,
      turnover_4b numeric(14,2) DEFAULT 0,
      field_1a numeric(14,2) DEFAULT 0,
      field_1b numeric(14,2) DEFAULT 0,
      field_1c numeric(14,2) DEFAULT 0,
      field_1d numeric(14,2) DEFAULT 0,
      field_1e numeric(14,2) DEFAULT 0,
      field_2a numeric(14,2) DEFAULT 0,
      field_3a numeric(14,2) DEFAULT 0,
      field_3b numeric(14,2) DEFAULT 0,
      field_3c numeric(14,2) DEFAULT 0,
      field_4a numeric(14,2) DEFAULT 0,
      field_4b numeric(14,2) DEFAULT 0,
      field_5a numeric(14,2) DEFAULT 0,
      field_5b numeric(14,2) DEFAULT 0,
      field_5c numeric(14,2) DEFAULT 0,
      submitted boolean NOT NULL DEFAULT false,
      submitted_at timestamptz,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, period)
    )
  `);

  for (const field of BTW_FILING_AMOUNT_FIELDS) {
    await pool.query(`
      ALTER TABLE public.btw_filing_fields
      ADD COLUMN IF NOT EXISTS ${field} numeric(14,2) DEFAULT 0
    `);
  }

  await pool.query('CREATE INDEX IF NOT EXISTS idx_btw_filing_user_period ON public.btw_filing_fields (user_id, period)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_btw_filing_year_quarter ON public.btw_filing_fields (year, quarter)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.other_income (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      source_name text NOT NULL,
      description text,
      category text NOT NULL DEFAULT 'overig',
      income_date date NOT NULL,
      amount numeric(14,2) NOT NULL DEFAULT 0,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_other_income_user_id ON public.other_income (user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_other_income_income_date ON public.other_income (income_date)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.subscription_plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      name text NOT NULL,
      billing_interval_months integer NOT NULL CHECK (billing_interval_months IN (1, 3, 6, 12)),
      monthly_price numeric(14,2) NOT NULL DEFAULT 0,
      invoice_amount numeric(14,2) NOT NULL DEFAULT 0,
      minimum_term_months integer NOT NULL DEFAULT 1,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_subscription_plans_user_active ON public.subscription_plans (user_id, is_active)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort_order ON public.subscription_plans (user_id, sort_order)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
      client_name text,
      service_name text NOT NULL DEFAULT 'Vevuno',
      plan_name text NOT NULL,
      billing_interval_months integer NOT NULL CHECK (billing_interval_months IN (1, 3, 6, 12)),
      monthly_price numeric(14,2) NOT NULL DEFAULT 0,
      invoice_amount numeric(14,2) NOT NULL DEFAULT 0,
      btw_percentage numeric(6,2) NOT NULL DEFAULT 21,
      start_date date NOT NULL,
      next_invoice_date date NOT NULL,
      last_invoice_date date,
      minimum_term_months integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions (user_id, status)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_next_invoice_date ON public.subscriptions (next_invoice_date)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.monthly_salaries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      year integer NOT NULL,
      month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
      gross_amount numeric(14,2) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, year, month)
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_monthly_salaries_user_year ON public.monthly_salaries (user_id, year)');
};

const startServer = async () => {
  try {
    await ensureRuntimeSchema();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
    sendOverdueInvoicePushNotifications();
    setInterval(sendOverdueInvoicePushNotifications, PUSH_CHECK_INTERVAL_MINUTES * 60 * 1000);
  } catch (err) {
    console.error('Failed to initialize runtime schema:', err);
    process.exit(1);
  }
};

startServer();

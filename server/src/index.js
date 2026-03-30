import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import bcryptjs from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import pool from './db.js';
import { authenticateToken, createTokens, verifyAccessToken, verifyRefreshToken } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const BODY_LIMIT = process.env.BODY_LIMIT || '1mb';
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB || 10);
const AUTH_WINDOW_MS = Number(process.env.AUTH_WINDOW_MS || 15 * 60 * 1000);
const AUTH_MAX_REQUESTS = Number(process.env.AUTH_MAX_REQUESTS || 30);
const ALLOWED_BUCKETS = ['receipts', 'invoice-attachments', 'logos'];

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bucket = req.body.bucket || 'receipts';
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return cb(new Error('Invalid upload bucket'));
    }
    const target = path.join(UPLOAD_ROOT, bucket);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    cb(null, target);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
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
    const userId = uuidv4();

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

    const { accessToken, refreshToken } = createTokens(userId);
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
    const result = await pool.query('SELECT id, password_hash FROM public.users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcryptjs.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = createTokens(user.id);
    res.json({ accessToken, refreshToken, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
app.post('/api/auth/refresh', authLimiter, (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  const { accessToken, refreshToken: newRefreshToken } = createTokens(decoded.userId);
  res.json({ accessToken, refreshToken: newRefreshToken });
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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
app.put('/api/invoices/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'items');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

  try {
    const result = await pool.query(
      `UPDATE public.invoices SET ${setClause} WHERE user_id = $${fields.length + 1} AND id = $${fields.length + 2} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'invoice_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const { vendor_name, description, category, expense_date, amount_excl_btw, btw_amount, amount_incl_btw, btw_percentage, btw_period, receipt_url, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.expenses (user_id, vendor_name, description, category, expense_date, amount_excl_btw, btw_amount, amount_incl_btw, btw_percentage, btw_period, receipt_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [req.userId, vendor_name, description, category, expense_date, amount_excl_btw, btw_amount, amount_incl_btw, btw_percentage, btw_period, receipt_url, notes]
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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const { period, year, quarter, is_closed, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.btw_periods (user_id, period, year, quarter, is_closed, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, period, year, quarter, is_closed, notes]
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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const fields = Object.keys(req.body).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  const values = fields.map(key => req.body[key]);
  values.push(req.userId);
  values.push(id);

  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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

app.get('/api/app-settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT setting_key, setting_value FROM public.app_settings ORDER BY setting_key ASC'
    );
    res.json(result.rows);
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
  const fields = Object.keys(req.body).filter((key) => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const values = fields.map((key) => req.body[key]);
  values.push(req.userId, id);
  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
  const fields = Object.keys(req.body).filter((key) => key !== 'id' && key !== 'user_id' && key !== 'created_at');
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const values = fields.map((key) => req.body[key]);
  values.push(req.userId, id);
  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');

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
    return res.status(400).json({ error: 'Invalid bucket' });
  }

  const url = `${PUBLIC_URL}/uploads/${bucket}/${req.file.filename}`;
  return res.status(201).json({
    url,
    path: `/uploads/${bucket}/${req.file.filename}`,
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

app.post('/api/invoices/:id/send-email', authenticateToken, async (req, res) => {
  const { recipientEmail, recipientName, customMessage } = req.body;
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

    const subject = `Factuur ${invoice.invoice_number}`;
    const messageLines = [
      `Beste ${recipientName || 'klant'},`,
      '',
      `Hierbij ontvang je factuur ${invoice.invoice_number}.`,
      `Factuurdatum: ${invoice.invoice_date}`,
      `Vervaldatum: ${invoice.due_date}`,
      `Totaalbedrag: EUR ${Number(invoice.total || 0).toFixed(2)}`,
      '',
    ];

    if (customMessage) {
      messageLines.push(customMessage, '');
    }

    messageLines.push('Met vriendelijke groet,', 'Easy Invoice Hub');

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject,
      text: messageLines.join('\n'),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error sending invoice email:', err);
    res.status(500).json({ error: 'Failed to send invoice email' });
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
// Start server
// ============================================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

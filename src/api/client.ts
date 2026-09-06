import axios, { AxiosHeaders } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/';
const API_BASE_URL = API_URL.replace(/\/$/, '');
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Attach access token as fallback when cookies are unavailable.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    config.headers = headers;
  }
  return config;
});

// Handle token refresh on auth failures.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if ((status === 401 || status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const refreshData = await response.json();
          if (refreshData?.accessToken) {
            localStorage.setItem('accessToken', refreshData.accessToken);
          }
          if (refreshData?.refreshToken) {
            localStorage.setItem('refreshToken', refreshData.refreshToken);
          }
          return api(originalRequest);
        }
      } catch (err) {
        console.error('Token refresh failed:', err);
      }

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    }

    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  register: (email, password) =>
    api.post('/api/auth/register', { email, password }),
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),
  verify: () =>
    api.post('/api/auth/verify'),
  logout: () =>
    api.post('/api/auth/logout'),
  callback: (code, state) =>
    api.post('/api/auth/callback', { code, state }),
};

// Profile
export const profile = {
  getProfile: () =>
    api.get('/api/profile'),
  updateProfile: (data) =>
    api.put('/api/profile', data),
};

// Clients
export const clients = {
  getAll: () =>
    api.get('/api/clients'),
  create: (data) =>
    api.post('/api/clients', data),
  update: (id, data) =>
    api.put(`/api/clients/${id}`, data),
  delete: (id) =>
    api.delete(`/api/clients/${id}`),
};

// Invoices
export const invoices = {
  getAll: () =>
    api.get('/api/invoices'),
  getOne: (id) =>
    api.get(`/api/invoices/${id}`),
  create: (data) =>
    api.post('/api/invoices', data),
  update: (id, data) =>
    api.put(`/api/invoices/${id}`, data),
  delete: (id) =>
    api.delete(`/api/invoices/${id}`),
  sendEmail: (id, data) =>
    api.post(`/api/invoices/${id}/send-email`, data),
};

// Invoice Items
export const invoiceItems = {
  create: (data) =>
    api.post('/api/invoice-items', data),
  update: (id, data) =>
    api.put(`/api/invoice-items/${id}`, data),
  delete: (id) =>
    api.delete(`/api/invoice-items/${id}`),
};

// Expenses
export const expenses = {
  getAll: () =>
    api.get('/api/expenses'),
  create: (data) =>
    api.post('/api/expenses', data),
  update: (id, data) =>
    api.put(`/api/expenses/${id}`, data),
  delete: (id) =>
    api.delete(`/api/expenses/${id}`),
};

export const otherIncome = {
  getAll: () =>
    api.get('/api/other-income'),
  create: (data) =>
    api.post('/api/other-income', data),
  update: (id, data) =>
    api.put(`/api/other-income/${id}`, data),
  delete: (id) =>
    api.delete(`/api/other-income/${id}`),
};

export const subscriptions = {
  getAll: () =>
    api.get('/api/subscriptions'),
  create: (data) =>
    api.post('/api/subscriptions', data),
  update: (id, data) =>
    api.put(`/api/subscriptions/${id}`, data),
  delete: (id) =>
    api.delete(`/api/subscriptions/${id}`),
};

export const subscriptionPlans = {
  getAll: () =>
    api.get('/api/subscription-plans'),
  create: (data) =>
    api.post('/api/subscription-plans', data),
  update: (id, data) =>
    api.put(`/api/subscription-plans/${id}`, data),
  delete: (id) =>
    api.delete(`/api/subscription-plans/${id}`),
};

// Projects
export const projects = {
  getAll: () =>
    api.get('/api/projects'),
  create: (data) =>
    api.post('/api/projects', data),
  update: (id, data) =>
    api.put(`/api/projects/${id}`, data),
  delete: (id) =>
    api.delete(`/api/projects/${id}`),
};

// Time Entries
export const timeEntries = {
  getAll: () =>
    api.get('/api/time-entries'),
  create: (data) =>
    api.post('/api/time-entries', data),
  update: (id, data) =>
    api.put(`/api/time-entries/${id}`, data),
  delete: (id) =>
    api.delete(`/api/time-entries/${id}`),
};

// BTW Periods
export const btwPeriods = {
  getAll: () =>
    api.get('/api/btw-periods'),
  create: (data) =>
    api.post('/api/btw-periods', data),
  update: (id, data) =>
    api.put(`/api/btw-periods/${id}`, data),
};

// Business Assets
export const businessAssets = {
  getAll: () =>
    api.get('/api/business-assets'),
  create: (data) =>
    api.post('/api/business-assets', data),
  update: (id, data) =>
    api.put(`/api/business-assets/${id}`, data),
  delete: (id) =>
    api.delete(`/api/business-assets/${id}`),
};

// Annual Tax Data
export const annualTaxData = {
  getAll: () =>
    api.get('/api/annual-tax-data'),
  save: (data) =>
    api.post('/api/annual-tax-data', data),
};

export const monthlySalaries = {
  getByYear: (year) =>
    api.get(`/api/monthly-salaries/${year}`),
  save: (data) =>
    api.post('/api/monthly-salaries', data),
  saveMany: (data) =>
    api.post('/api/monthly-salaries/bulk', data),
};

export const appSettings = {
  getAll: () =>
    api.get('/api/app-settings'),
  update: (key, value) =>
    api.put(`/api/app-settings/${key}`, { value }),
  upsertMany: (settings) =>
    api.put('/api/app-settings', { settings }),
};

export const pushNotifications = {
  getConfig: () =>
    api.get('/api/push/config'),
  subscribe: (subscription) =>
    api.post('/api/push/subscriptions', { subscription }),
  unsubscribe: (endpoint) =>
    api.delete('/api/push/subscriptions', { data: { endpoint } }),
  sendTest: () =>
    api.post('/api/push/test'),
};

export const rabobank = {
  getStatus: () =>
    api.get('/api/rabobank/status'),
  connect: () =>
    api.post('/api/rabobank/connect'),
  disconnect: () =>
    api.delete('/api/rabobank/connection'),
};

export const userRole = {
  getCurrent: () =>
    api.get('/api/user-role'),
};

export const adminUsers = {
  getAll: () =>
    api.get('/api/admin/users'),
  delete: (id) =>
    api.delete(`/api/admin/users/${id}`),
};

export const labels = {
  getAll: () =>
    api.get('/api/labels'),
  create: (data) =>
    api.post('/api/labels', data),
  update: (id, data) =>
    api.put(`/api/labels/${id}`, data),
  delete: (id) =>
    api.delete(`/api/labels/${id}`),
};

export const calendarEvents = {
  getAll: () =>
    api.get('/api/calendar-events'),
  create: (data) =>
    api.post('/api/calendar-events', data),
  update: (id, data) =>
    api.put(`/api/calendar-events/${id}`, data),
  delete: (id) =>
    api.delete(`/api/calendar-events/${id}`),
};

export const externalFeeds = {
  getAll: () =>
    api.get('/api/external-feeds'),
  create: (data) =>
    api.post('/api/external-feeds', data),
  delete: (id) =>
    api.delete(`/api/external-feeds/${id}`),
};

export const files = {
  upload: (file, bucket) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    return api.post('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: (path) =>
    api.delete('/api/files', { data: { path } }),
};

export const calendar = {
  getIcalUrl: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return '';
    return `${API_URL}/api/calendar/ical?access_token=${encodeURIComponent(token)}`;
  },
};

// BTW Filing Fields
export const btwFilingFields = {
  getByPeriod: (period) =>
    api.get(`/api/btw-filing-fields/${period}`),
  getByYearQuarter: (year, quarter) =>
    api.get(`/api/btw-filing-fields/year-quarter/${year}/${quarter}`),
  upsert: (data) =>
    api.post('/api/btw-filing-fields', data),
  update: (id, data) =>
    api.put(`/api/btw-filing-fields/${id}`, data),
  submit: (id) =>
    api.post(`/api/btw-filing-fields/${id}/submit`),
};

export default api;

import axios from 'axios';

// REACT_APP_API_URL is baked in at build time by webpack DefinePlugin.
// In production (GitHub Pages build) it is set to the Vercel backend URL via
// the REACT_APP_API_URL GitHub Actions secret.
// Locally it falls back to '/api' which is proxied by webpack-dev-server to
// http://localhost:5000.
const API_BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: false,
});

// Global response error handler — surfaces CORS / network failures clearly
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      // Network error or CORS preflight failure
      console.error(
        `[API] Network/CORS error reaching ${API_BASE}. Is the backend running and CORS configured?`,
        err.message,
      );
    }
    return Promise.reject(err);
  },
);

// Demo mode: no login token is required (or sent) for the educational routes.

export const demoService = {
  getAccounts: async () => {
    const res = await api.get('/demo/accounts');
    return res.data;
  },
};

export const transactionService = {
  create: async (data) => {
    const res = await api.post('/transactions', data);
    return res.data;
  },
  process: async (transactionId, options = {}) => {
    const res = await api.post(`/transactions/${transactionId}/process`, options);
    return res.data;
  },
  processTransaction: async (transactionId, options = {}) => {
    return transactionService.process(transactionId, options);
  },
  verifySecurity: async (transactionId, options = {}) => {
    const res = await api.post(`/transactions/${transactionId}/verify-security`, options);
    return res.data;
  },
  verifyIntegrity: async (transactionId, options = {}) => {
    const res = await api.post(`/transactions/${transactionId}/verify-integrity`, options);
    return res.data;
  },
  verifyHmac: async (transactionId, options = {}) => {
    const res = await api.post(`/transactions/${transactionId}/verify-hmac`, options);
    return res.data;
  },
  verifySignature: async (transactionId, options = {}) => {
    const res = await api.post(`/transactions/${transactionId}/verify-signature`, options);
    return res.data;
  },
  getStatus: async (transactionId) => {
    const res = await api.get(`/transactions/${encodeURIComponent(transactionId)}/status`);
    return res.data;
  },
  getAll: async (params) => {
    const res = await api.get('/transactions', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/transactions/${id}`);
    return res.data;
  },
};

// Aliased paymentService for backward compatibility across modules
export const paymentService = {
  prepare: async (data) => transactionService.create(data),
  execute: async (data) => transactionService.create(data),
  process: (transactionId, options = {}) => transactionService.process(transactionId, options),
  verifySecurity: (transactionId, options = {}) => transactionService.verifySecurity(transactionId, options),
  getAll: (params) => transactionService.getAll(params),
  getById: (id) => transactionService.getById(id),
};

export const verifyService = {
  inspect: async (payload) => {
    const res = await api.post('/verify/inspect', payload);
    return res.data;
  },
  verifySecurity: (transactionId, options) => transactionService.verifySecurity(transactionId, options),
  verifyIntegrity: (transactionId, options) => transactionService.verifyIntegrity(transactionId, options),
  verifyHmac: (transactionId, options) => transactionService.verifyHmac(transactionId, options),
  verifySignature: (transactionId, options) => transactionService.verifySignature(transactionId, options),
};

export const simulationService = {
  tamper: async (data) => {
    const res = await api.post('/attacks/tamper', data);
    return res.data;
  },
  replay: async (data) => {
    const res = await api.post('/attacks/replay', data);
    return res.data;
  },
  forge: async (data) => {
    const res = await api.post('/attacks/forge', data);
    return res.data;
  },
  fakeConfirmation: async (data) => {
    const res = await api.post('/attacks/fake-confirmation', data);
    return res.data;
  },
  simulate: async (data) => {
    const res = await api.post('/attacks/attack', data);
    return res.data;
  },
};

export const securityService = {
  getMetrics: async () => {
    const res = await api.get('/security/metrics');
    return res.data;
  },
  getSecuritySummary: async () => {
    const res = await api.get('/dashboard/security-summary');
    return res.data;
  },
  getLogs: async (params) => {
    const res = await api.get('/security/logs', { params });
    return res.data;
  },
  reset: async () => {
    const res = await api.post('/security/reset');
    return res.data;
  },
};

export const dashboardService = {
  getSecuritySummary: async () => {
    const res = await api.get('/dashboard/security-summary');
    return res.data;
  },
  getMetrics: async () => {
    const res = await api.get('/dashboard/security-summary');
    return res.data;
  },
  reset: async () => {
    const res = await api.post('/security/reset');
    return res.data;
  },
};

export default api;

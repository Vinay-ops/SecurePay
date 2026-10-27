const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { connectDB, getDBStatus } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { getStorageMode } = require('./config/secrets');

// Connect to Database
connectDB();

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const clientUrl = (process.env.CLIENT_URL || '').replace(/\/+$/, '');
    if (
      !clientUrl ||
      clientUrl === '*' ||
      origin === 'https://vinay-ops.github.io' ||
      origin.startsWith('https://vinay-ops.github.io') ||
      origin === 'http://localhost:3000' ||
      origin === clientUrl
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.status(200).json({
    status: 'HEALTHY',
    service: 'Secure Digital Payment System (Cryptography Simulator)',
    timestamp: new Date().toISOString(),
    authMode: 'DEMO (no login required for educational routes)',
    storageMode: getStorageMode(dbStatus.connected),
    database: dbStatus,
    cryptoEngine: {
      integrity: 'SHA-256',
      authentication: 'HMAC-SHA-256',
      digitalSignature: 'RSA-2048 (PKCS#1 v1.5)',
      replayDefense: 'Nonce + Timestamp Window',
      confidentiality: 'AES-256-GCM',
    },
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/demo', require('./routes/demoRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/verify', require('./routes/verifyRoutes'));
app.use('/api/simulation', require('./routes/simulationRoutes'));
app.use('/api/attacks', require('./routes/simulationRoutes'));
app.use('/api/security', require('./routes/securityRoutes'));
app.use('/api/dashboard', require('./routes/securityRoutes'));

// Error Handlers
app.use(notFound);
app.use(errorHandler);

// Port resolution: a configured PORT > 0 is honoured; PORT=0 (or invalid) would
// silently bind a random port and break the documented :5000 API, so fall back
// to the default 5000 instead.
const parsedPort = Number(process.env.PORT);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🔐 Cryptographic Payment Simulator API running on port ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log(`🛡️  Crypto Engine Active: SHA-256 | HMAC | RSA-2048 | Nonce`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;

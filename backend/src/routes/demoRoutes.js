const express = require('express');
const router = express.Router();
const { listDemoAccounts, DEFAULT_BALANCE } = require('../store/demoAccounts');
const { getStorageMode } = require('../config/secrets');
const { getDBStatus } = require('../config/db');

/**
 * Demo environment identity + balance discovery (NO LOGIN REQUIRED).
 * GET /api/demo/accounts
 *
 * The two seeded identities are SHARED demonstration accounts used by the
 * educational demo - they are not private user accounts.
 */
router.get('/accounts', async (req, res, next) => {
  try {
    const dbStatus = getDBStatus();
    const accounts = await listDemoAccounts();

    res.status(200).json({
      success: true,
      mode: 'DEMO_NO_AUTH',
      storageMode: getStorageMode(dbStatus.connected),
      database: dbStatus,
      startingBalance: DEFAULT_BALANCE,
      accounts,
      note:
        'Alice and Bob are shared demonstration identities (not private accounts). Balances are simulated and start at ' +
        DEFAULT_BALANCE +
        '. In in-memory fallback mode balances reset when the server restarts.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  simulateTamperingAttack,
  simulateReplayAttack,
  simulateForgeryAttack,
  simulateFakeConfirmation,
  simulateAttack,
} = require('../controllers/simulationController');

// Dedicated Attack Simulation Endpoints
router.post('/tamper', simulateTamperingAttack);
router.post('/replay', simulateReplayAttack);
router.post('/forge', simulateForgeryAttack);
router.post('/fake-confirmation', simulateFakeConfirmation);

// Legacy unified endpoint
router.post('/attack', simulateAttack);

module.exports = router;

const crypto = require('crypto');

/**
 * ============================================================================
 * SECRET RESOLUTION MODULE
 * ============================================================================
 * Secrets are NEVER hardcoded. Resolution order:
 *   1. Environment variable (HMAC_SECRET / JWT_SECRET) - production requirement.
 *   2. Development/demo only: a random ephemeral secret generated once per
 *      process. It is never written to disk, never returned by any API and is
 *      discarded when the process exits, so there is no fixed "default
 *      production secret" left anywhere in the codebase.
 *   3. Production without configuration: resolution FAILS (returns null) so the
 *      caller responds with an explicit configuration error instead of
 *      silently operating with a guessable secret.
 * ============================================================================
 */

let ephemeralHmacSecret = null;
let ephemeralJwtSecret = null;
let warnedHmac = false;
let warnedJwt = false;

const isProduction = () => process.env.NODE_ENV === 'production';

function getHmacSecret() {
  const configured = process.env.HMAC_SECRET;
  if (configured && configured.trim().length >= 16) {
    return configured;
  }
  if (isProduction()) {
    return null; // fail safely - caller must reject the request
  }
  if (!ephemeralHmacSecret) {
    ephemeralHmacSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!warnedHmac) {
    warnedHmac = true;
    console.warn(
      '[Security] HMAC_SECRET is not configured. Using a random ephemeral development secret for this process only. Set HMAC_SECRET before running in production.'
    );
  }
  return ephemeralHmacSecret;
}

function getJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.trim().length >= 16) {
    return configured;
  }
  if (isProduction()) {
    return null;
  }
  if (!ephemeralJwtSecret) {
    ephemeralJwtSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!warnedJwt) {
    warnedJwt = true;
    console.warn(
      '[Security] JWT_SECRET is not configured. Using a random ephemeral development secret for this process only.'
    );
  }
  return ephemeralJwtSecret;
}

/**
 * Returns the HMAC secret, or sends a 503 configuration error and returns null.
 * Use in request handlers so a missing secret fails safely and explicitly.
 */
function requireHmacSecret(res) {
  const secret = getHmacSecret();
  if (!secret) {
    res.status(503).json({
      success: false,
      reason: 'HMAC_SECRET_NOT_CONFIGURED',
      message:
        'Server-side HMAC secret is not configured. Refusing to authenticate transactions without a secret. Set HMAC_SECRET in the backend environment.',
    });
    return null;
  }
  return secret;
}

/** Destructive/demo-only endpoints are disabled in production by default. */
function isDemoResetAllowed() {
  if (process.env.ALLOW_DEMO_RESET === 'true') return true;
  return !isProduction();
}

/** Human readable storage mode for the demo UI. */
function getStorageMode(connected) {
  return connected
    ? 'MongoDB (persistent)'
    : 'Local file store (persistent fallback)';
}

module.exports = {
  getHmacSecret,
  getJwtSecret,
  requireHmacSecret,
  isDemoResetAllowed,
  isProduction,
  getStorageMode,
};

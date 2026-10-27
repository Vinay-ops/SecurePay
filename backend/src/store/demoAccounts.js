const crypto = require('crypto');

/**
 * ============================================================================
 * DEMO ACCOUNT STORE — pure in-memory only (no database required)
 * ============================================================================
 * Two shared demonstration identities are seeded:
 *   - Shubham (shubham@securepay.demo)  → demo sender
 *   - Vinay   (vinay@securepay.demo)    → demo receiver
 *
 * Any other name typed into the payment form is auto-provisioned with the
 * same starting balance so the academic demo works without registration.
 * ============================================================================
 */

const DEFAULT_BALANCE = 50000;

const DEMO_ACCOUNTS = [
  {
    name: 'Shubham',
    email: 'shubham@securepay.demo',
    displayName: 'Shubham (Demo Sender)',
    shared: true,
  },
  {
    name: 'Vinay',
    email: 'vinay@securepay.demo',
    displayName: 'Vinay (Demo Receiver)',
    shared: true,
  },
];

const memoryAccounts = new Map(); // key → { name, email, balance, shared, provisioned }

const normalize = (value) => String(value || '').trim().toLowerCase();
const accountKey = (identifier) => normalize(identifier);

function slugify(name) {
  return (
    normalize(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40) || 'demo-user'
  );
}

function syntheticEmail(identifier) {
  const digest = crypto
    .createHash('sha256')
    .update(normalize(identifier))
    .digest('hex')
    .substring(0, 10);
  return `${slugify(identifier)}-${digest}@demo.securepay.local`;
}

function seedMemory() {
  for (const acct of DEMO_ACCOUNTS) {
    const emailKey = accountKey(acct.email);
    if (!memoryAccounts.has(emailKey)) {
      const record = {
        name: acct.name,
        email: acct.email,
        balance: DEFAULT_BALANCE,
        shared: true,
        provisioned: false,
      };
      memoryAccounts.set(emailKey, record);
      // Also index by lowercase name so lookups by name work
      memoryAccounts.set(accountKey(acct.name), record);
    }
  }
}

// Seed on module load
seedMemory();

/**
 * Resolve an account by name or email, auto-provisioning it when unknown.
 * Returns { id, name, email, balance, shared, provisioned }
 */
async function resolveAccount(identifier) {
  const id = String(identifier || '').trim();
  if (!id) return null;

  const key = accountKey(id);
  if (!memoryAccounts.has(key)) {
    const known = DEMO_ACCOUNTS.find(
      (d) => normalize(d.name) === key || normalize(d.email) === key,
    );
    const record = {
      name: known ? known.name : id,
      email: known ? known.email : syntheticEmail(id),
      balance: DEFAULT_BALANCE,
      shared: !!known,
      provisioned: !known,
    };
    memoryAccounts.set(key, record);
  }

  const acc = memoryAccounts.get(key);
  acc.id = key;
  return acc;
}

/** Read-only balance lookup (auto-provisions unknown identities). */
async function getBalance(identifier) {
  const acc = await resolveAccount(identifier);
  return acc ? acc.balance : null;
}

/**
 * Debit an account. Returns { ok, balance, reason }.
 */
async function debit(identifier, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, reason: 'INVALID_AMOUNT' };
  }

  const acc = await resolveAccount(identifier);
  if (!acc) return { ok: false, reason: 'ACCOUNT_NOT_FOUND' };

  if (acc.balance < value) {
    return { ok: false, reason: 'INSUFFICIENT_BALANCE', balance: acc.balance };
  }
  acc.balance = parseFloat((acc.balance - value).toFixed(2));
  return { ok: true, balance: acc.balance };
}

/** Credit an account. Returns { ok, balance }. */
async function credit(identifier, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, reason: 'INVALID_AMOUNT' };
  }

  const acc = await resolveAccount(identifier);
  if (!acc) return { ok: false, reason: 'ACCOUNT_NOT_FOUND' };

  acc.balance = parseFloat((acc.balance + value).toFixed(2));
  return { ok: true, balance: acc.balance };
}

/** The two seeded shared demo identities with their live balances. */
async function listDemoAccounts() {
  const accounts = [];
  for (const acct of DEMO_ACCOUNTS) {
    const resolved = await resolveAccount(acct.name);
    accounts.push({
      name: resolved ? resolved.name : acct.name,
      email: acct.email,
      displayName: acct.displayName,
      balance: resolved ? resolved.balance : DEFAULT_BALANCE,
      startingBalance: DEFAULT_BALANCE,
      isSharedDemoIdentity: true,
    });
  }
  return accounts;
}

module.exports = {
  DEFAULT_BALANCE,
  DEMO_ACCOUNTS,
  resolveAccount,
  getBalance,
  debit,
  credit,
  listDemoAccounts,
};

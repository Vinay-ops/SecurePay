// Local file-backed store used when MongoDB is not configured.
// The arrays remain the in-process API used by the controllers, while the
// JSON file keeps data across backend restarts.
const fs = require('fs');
const path = require('path');
const os = require('os');

const backendRoot = path.resolve(__dirname, '..', '..');
const defaultPersistentStorePath = path.join(backendRoot, 'data', 'securepay.json');
const defaultServerlessStorePath = path.join(os.tmpdir(), 'securepay', 'securepay.json');
const configuredStorePath = process.env.LOCAL_DB_PATH;
let storePath = configuredStorePath
  ? (path.isAbsolute(configuredStorePath)
    ? configuredStorePath
    : path.resolve(backendRoot, configuredStorePath))
  : (process.env.VERCEL ? defaultServerlessStorePath : defaultPersistentStorePath);

const inMemoryTransactions = [];
const inMemoryLogs = [];
let warnedFallback = false;

function loadStore() {
  if (!fs.existsSync(storePath)) return;

  try {
    const stored = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    if (Array.isArray(stored.transactions)) {
      inMemoryTransactions.push(...stored.transactions);
    }
    if (Array.isArray(stored.logs)) {
      inMemoryLogs.push(...stored.logs);
    }
  } catch (error) {
    console.warn(`[Database] Could not load local store at ${storePath}: ${error.message}`);
  }
}

function saveStore() {
  try {
    const directory = path.dirname(storePath);
    fs.mkdirSync(directory, { recursive: true });

    const temporaryPath = `${storePath}.tmp`;
    fs.writeFileSync(
      temporaryPath,
      JSON.stringify({
        transactions: inMemoryTransactions,
        logs: inMemoryLogs,
      }, null, 2),
      'utf8'
    );
    fs.renameSync(temporaryPath, storePath);
    return true;
  } catch (error) {
    const canFallbackToTmp = storePath !== defaultServerlessStorePath;
    if (canFallbackToTmp) {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn(
          `[Database] Local store path ${storePath} is not writable (${error.code || 'UNKNOWN'}: ${error.message}). Falling back to temporary storage at ${defaultServerlessStorePath}.`
        );
      }
      storePath = defaultServerlessStorePath;
      return saveStore();
    }

    console.error(
      `[Database] Failed to persist local store at ${storePath} (${error.code || 'UNKNOWN'}: ${error.message}). Continuing in memory only.`
    );
    return false;
  }
}

loadStore();

const getStorePath = () => storePath;
const isStorePersistent = () => storePath !== defaultServerlessStorePath;

module.exports = {
  inMemoryTransactions,
  inMemoryLogs,
  saveStore,
  getStorePath,
  isStorePersistent,
};

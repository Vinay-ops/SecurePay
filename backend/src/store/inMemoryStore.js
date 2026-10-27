// Local file-backed store used when MongoDB is not configured.
// The arrays remain the in-process API used by the controllers, while the
// JSON file keeps data across backend restarts.
const fs = require('fs');
const path = require('path');

const defaultStorePath = path.join(__dirname, '..', '..', 'data', 'securepay.json');
const configuredStorePath = process.env.LOCAL_DB_PATH;
const storePath = configuredStorePath
  ? (path.isAbsolute(configuredStorePath)
    ? configuredStorePath
    : path.resolve(__dirname, '..', '..', configuredStorePath))
  : defaultStorePath;

const inMemoryTransactions = [];
const inMemoryLogs = [];

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
}

loadStore();

module.exports = {
  inMemoryTransactions,
  inMemoryLogs,
  saveStore,
  storePath,
};

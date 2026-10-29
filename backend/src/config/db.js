const { getStorePath, isStorePersistent } = require('../store/inMemoryStore');

const connectDB = async () => {
  console.log(`[Database] MongoDB is not configured. Using local store at ${getStorePath()}.`);
};

const getDBStatus = () => ({
  connected: false,
  readyState: 0,
  host: 'Local File Store',
  name: getStorePath(),
  persistent: isStorePersistent(),
});

module.exports = { connectDB, getDBStatus };

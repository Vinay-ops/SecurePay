const { storePath } = require('../store/inMemoryStore');

const connectDB = async () => {
  console.log(`[Database] MongoDB is not configured. Using persistent local store at ${storePath}.`);
};

const getDBStatus = () => ({
  connected: false,
  readyState: 0,
  host: 'Local File Store',
  name: storePath,
  persistent: true,
});

module.exports = { connectDB, getDBStatus };

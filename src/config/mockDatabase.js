const logger = require('../utils/logger');

// Mock database connection for testing without MongoDB
const connectMockDB = async () => {
  try {
    logger.info('🔧 Using MOCK Database (no MongoDB required)');
    logger.info('✅ Mock Database Connected: localhost:27017/queue_management_db_mock');
    
    // Return a mock connection object
    return {
      connection: {
        host: 'localhost',
        port: 27017,
        name: 'queue_management_db_mock'
      }
    };
  } catch (error) {
    logger.error('Mock database connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectMockDB;

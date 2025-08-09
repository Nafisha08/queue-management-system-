const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Create a simple logger
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  warn: (msg) => console.log(`[WARN] ${new Date().toISOString()} ${msg}`),
  error: (msg) => console.log(`[ERROR] ${new Date().toISOString()} ${msg}`)
};

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const tokenRoutes = require('./src/routes/tokenRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const counterRoutes = require('./src/routes/counterRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: 'Mock Database',
    port: PORT
  });
});

// API Routes
const API_BASE = process.env.API_BASE_PATH || '/api';
const API_VERSION = process.env.API_VERSION || 'v1';

// Mount routes
app.use(`${API_BASE}/${API_VERSION}/auth`, authRoutes);
app.use(`${API_BASE}/${API_VERSION}/customers`, customerRoutes);
app.use(`${API_BASE}/${API_VERSION}/payments`, paymentRoutes);
app.use(`${API_BASE}/${API_VERSION}/tokens`, tokenRoutes);
app.use(`${API_BASE}/${API_VERSION}/departments`, departmentRoutes);
app.use(`${API_BASE}/${API_VERSION}/counters`, counterRoutes);

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Queue Management System API',
    version: '1.0.0',
    status: 'Running',
    apiBase: `${API_BASE}/${API_VERSION}`,
    endpoints: {
      health: '/health',
      login: `${API_BASE}/${API_VERSION}/auth/login`,
      customers: `${API_BASE}/${API_VERSION}/customers`,
      tokens: `${API_BASE}/${API_VERSION}/tokens`,
      payments: `${API_BASE}/${API_VERSION}/payments`,
      departments: `${API_BASE}/${API_VERSION}/departments`,
      counters: `${API_BASE}/${API_VERSION}/counters`
    },
    testCredentials: {
      username: 'admin',
      password: 'password123',
      roles: ['superadmin', 'admin', 'subadmin', 'user']
    }
  });
});

// Catch-all handler for API routes
app.get(`${API_BASE}/${API_VERSION}`, (req, res) => {
  res.json({
    message: 'Queue Management System API v1',
    status: 'Active',
    endpoints: [
      'POST /auth/login - Login',
      'GET /customers - List customers',
      'POST /tokens - Generate tokens',
      'GET /payments - List payments',
      'GET /departments - List departments',
      'GET /counters - List counters'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith(`${API_BASE}/`)) {
    return res.status(404).json({ 
      error: 'API endpoint not found',
      availableEndpoints: [
        `${API_BASE}/${API_VERSION}/auth/login`,
        `${API_BASE}/${API_VERSION}/customers`,
        `${API_BASE}/${API_VERSION}/tokens`,
        `${API_BASE}/${API_VERSION}/payments`,
        `${API_BASE}/${API_VERSION}/departments`,
        `${API_BASE}/${API_VERSION}/counters`
      ]
    });
  }
  res.status(404).json({ error: 'Page not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
async function startServer() {
  try {
    logger.info('🔧 Using MOCK Database (no MongoDB required)');
    logger.warn('⚠️  Using MOCK database - data will not persist');
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 QUEUE MANAGEMENT SYSTEM STARTED');
      console.log('='.repeat(60));
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 API Base URL: http://localhost:${PORT}${API_BASE}/${API_VERSION}`);
      
      console.log('\n🔐 TEST CREDENTIALS:');
      console.log('   Username: admin (or superadmin, subadmin, user)');
      console.log('   Password: password123');
      
      console.log('\n🌐 QUICK LINKS:');
      console.log(`   Health Check: http://localhost:${PORT}/health`);
      console.log(`   API Info: http://localhost:${PORT}${API_BASE}/${API_VERSION}`);
      console.log(`   Login: POST http://localhost:${PORT}${API_BASE}/${API_VERSION}/auth/login`);
      
      console.log('\n📋 TEST COMMANDS:');
      console.log('   1. Open browser: http://localhost:' + PORT + '/health');
      console.log('   2. Test login: node test-login.js');
      console.log('   3. Use Postman with base URL: http://localhost:' + PORT + API_BASE + '/' + API_VERSION);
      
      console.log('\n✨ Server ready for testing!');
      console.log('Press Ctrl+C to stop');
      console.log('='.repeat(60) + '\n');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server: ' + error.message);
    process.exit(1);
  }
}

// Start the application
startServer();

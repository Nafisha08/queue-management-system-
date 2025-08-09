const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import modules
const connectDB = require('./config/database');
const connectMockDB = require('./config/mockDatabase');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { initializeScheduler } = require('./services/scheduler');

// Import routes
const projectRoutes = require('./routes/projectRoutes');
const queueRoutes = require('./routes/queueRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const testRoutes = require('./routes/testRoutes');
const customerRoutes = require('./routes/customerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const counterRoutes = require('./routes/counterRoutes');
const authRoutes = require('./routes/authRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Logging
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('../package.json').version
  });
});

// API Routes
const API_BASE = process.env.API_BASE_PATH || '/api';
const API_VERSION = process.env.API_VERSION || 'v1';

app.use(`${API_BASE}/${API_VERSION}/auth`, authRoutes);
app.use(`${API_BASE}/${API_VERSION}/test`, testRoutes);
app.use(`${API_BASE}/${API_VERSION}/projects`, projectRoutes);
app.use(`${API_BASE}/${API_VERSION}/queues`, queueRoutes);
app.use(`${API_BASE}/${API_VERSION}/users`, userRoutes);
app.use(`${API_BASE}/${API_VERSION}/customers`, customerRoutes);
app.use(`${API_BASE}/${API_VERSION}/payments`, paymentRoutes);
app.use(`${API_BASE}/${API_VERSION}/tokens`, tokenRoutes);
app.use(`${API_BASE}/${API_VERSION}/departments`, departmentRoutes);
app.use(`${API_BASE}/${API_VERSION}/counters`, counterRoutes);
app.use(`${API_BASE}/${API_VERSION}/dashboard`, dashboardRoutes);

// Serve static files for frontend (if any)
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith(`${API_BASE}/`)) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Database connection and server startup
async function startServer() {
  try {
    // Connect to database (use mock if specifically configured)
    const useMockDB = process.env.USE_MOCK_DB === 'true' || 
                     process.env.MONGODB_URI.includes('<username>');
    
    if (useMockDB) {
      await connectMockDB();
      logger.warn('⚠️  Using MOCK database - data will not persist');
    } else {
      await connectDB();
    }
    
    // Initialize scheduler if enabled
    if (process.env.SCHEDULER_ENABLED === 'true') {
      await initializeScheduler();
      logger.info('Scheduler initialized');
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Queue Management System started on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`📡 API Base URL: http://localhost:${PORT}${API_BASE}/${API_VERSION}`);
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
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = app;

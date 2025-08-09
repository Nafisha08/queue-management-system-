const express = require('express');
const router = express.Router();

/**
 * @desc    Test endpoint - no authentication required
 * @route   GET /api/v1/test
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Queue Management System API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: process.env.USE_MOCK_DB === 'true' ? 'Mock Database (No MongoDB required)' : 'MongoDB'
  });
});

/**
 * @desc    Test API endpoints overview
 * @route   GET /api/v1/test/endpoints
 * @access  Public
 */
router.get('/endpoints', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/v1`;
  
  res.status(200).json({
    success: true,
    message: 'Available API endpoints',
    endpoints: {
      test: {
        'GET /test': 'This endpoint - test API functionality',
        'GET /test/endpoints': 'List all available endpoints'
      },
      auth: {
        'POST /users/register': 'Register new user (requires MongoDB)',
        'POST /users/login': 'User login (requires MongoDB)',
        'GET /users/me': 'Get current user profile (requires auth)'
      },
      projects: {
        'GET /projects': 'Get projects list (requires auth)',
        'POST /projects': 'Create new project (requires auth)',
        'GET /projects/:id': 'Get project details (requires auth)'
      },
      queues: {
        'GET /queues': 'Get queues list (requires auth)',
        'POST /queues': 'Create new queue (requires auth)',
        'GET /queues/:id': 'Get queue details (requires auth)'
      },
      health: {
        'GET /health': 'System health check (no auth required)'
      }
    },
    baseUrl,
    note: 'Most endpoints require authentication when using real MongoDB. Current setup uses mock database.'
  });
});

/**
 * @desc    Test database status
 * @route   GET /api/v1/test/database
 * @access  Public
 */
router.get('/database', (req, res) => {
  res.status(200).json({
    success: true,
    database: {
      type: process.env.USE_MOCK_DB === 'true' ? 'Mock Database' : 'MongoDB',
      connection: process.env.USE_MOCK_DB === 'true' ? 'Active (Mock)' : 'Unknown',
      uri: process.env.USE_MOCK_DB === 'true' ? 'mock://localhost:27017/queue_management_db_mock' : process.env.MONGODB_URI,
      note: process.env.USE_MOCK_DB === 'true' ? 'Using mock database - data will not persist' : 'Using real MongoDB database'
    },
    recommendations: process.env.USE_MOCK_DB === 'true' ? [
      'To use real database, set USE_MOCK_DB=false in .env',
      'Set up MongoDB Atlas: https://www.mongodb.com/atlas',
      'Or install MongoDB locally: winget install MongoDB.Server'
    ] : [
      'Real database is configured',
      'Make sure MongoDB is running and accessible'
    ]
  });
});

module.exports = router;

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ 
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false 
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'development',
    message: 'Queue Management System - Demo Mode'
  });
});

// Demo API endpoints (without database)
app.post('/api/v1/users/login', (req, res) => {
  const { identifier, password } = req.body;
  
  // Demo credentials
  if ((identifier === 'admin@demo.com' || identifier === 'admin') && password === 'admin123') {
    res.json({
      success: true,
      data: {
        _id: 'demo-admin-id',
        username: 'admin',
        email: 'admin@demo.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
      },
      token: 'demo-jwt-token-admin'
    });
  } else if ((identifier === 'worker@demo.com' || identifier === 'worker') && password === 'worker123') {
    res.json({
      success: true,
      data: {
        _id: 'demo-worker-id',
        username: 'worker',
        email: 'worker@demo.com',
        firstName: 'Demo',
        lastName: 'Worker',
        role: 'worker'
      },
      token: 'demo-jwt-token-worker'
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

app.post('/api/v1/users/register', (req, res) => {
  const { username, email, password, firstName, lastName } = req.body;
  
  res.json({
    success: true,
    data: {
      _id: 'demo-new-user-id',
      username,
      email,
      firstName,
      lastName,
      role: 'worker'
    },
    token: 'demo-jwt-token-new',
    message: 'Registration successful! You can now login.'
  });
});

// Dashboard data endpoint
app.get('/api/v1/dashboard', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalProjects: 12,
      activeQueues: 8,
      itemsInProgress: 34,
      itemsCompleted: 156,
      completionRate: 82,
      avgProcessingTime: '2.4 hours'
    },
    activities: [
      {
        type: 'project_created',
        title: 'New Project Created',
        description: 'Mobile App Redesign project has been created',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        user: { name: 'John Doe' }
      },
      {
        type: 'item_completed',
        title: 'Task Completed',
        description: 'User authentication module completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        user: { name: 'Jane Smith' }
      },
      {
        type: 'queue_created',
        title: 'Queue Created',
        description: 'Development queue created for backend tasks',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        user: { name: 'Admin User' }
      }
    ],
    charts: {
      queueDistribution: {
        labels: ['Development', 'Testing', 'Design', 'Review'],
        values: [45, 25, 20, 10]
      },
      statusDistribution: {
        labels: ['Pending', 'In Progress', 'Completed', 'Blocked'],
        values: [30, 40, 25, 5]
      },
      weeklyTrend: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        added: [12, 15, 8, 20, 18, 5, 3],
        completed: [8, 12, 15, 16, 14, 8, 2]
      }
    }
  });
});

// Projects endpoint
app.get('/api/v1/projects', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        _id: 'proj1',
        name: 'Mobile App Redesign',
        description: 'Complete redesign of mobile application UI/UX',
        status: 'in_progress',
        category: 'design',
        priority: 'high',
        progress: 65,
        queueCount: 8,
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-05T14:30:00Z'
      },
      {
        _id: 'proj2',
        name: 'API Development',
        description: 'RESTful API development for web application',
        status: 'pending',
        category: 'development',
        priority: 'medium',
        progress: 25,
        queueCount: 5,
        createdAt: '2025-01-02T09:00:00Z',
        updatedAt: '2025-01-04T16:45:00Z'
      },
      {
        _id: 'proj3',
        name: 'Database Optimization',
        description: 'Performance optimization of database queries',
        status: 'completed',
        category: 'development',
        priority: 'high',
        progress: 100,
        queueCount: 3,
        createdAt: '2024-12-15T08:00:00Z',
        updatedAt: '2025-01-03T11:20:00Z'
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 3,
      pages: 1
    }
  });
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  console.log('\n🚀 Queue Management System - Demo Mode');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'public')}`);
  console.log('🔧 Environment: Development (Demo Mode)');
  console.log('\n📝 Demo Login Credentials:');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│ 👤 ADMIN USER:                         │');
  console.log('│    Email: admin@demo.com               │');
  console.log('│    Password: admin123                  │');
  console.log('│                                         │');
  console.log('│ 👤 WORKER USER:                        │');
  console.log('│    Email: worker@demo.com              │');
  console.log('│    Password: worker123                 │');
  console.log('└─────────────────────────────────────────┘');
  console.log('\n✨ Features Available:');
  console.log('   • Login/Registration system');
  console.log('   • Dashboard with charts');
  console.log('   • Projects management');
  console.log('   • Demo data included');
  console.log('\n🎯 Open your browser and go to: http://localhost:3000');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n📡 Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

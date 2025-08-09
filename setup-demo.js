#!/usr/bin/env node

/**
 * Demo Setup Script
 * Creates an initial admin user for testing the Queue Management System
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

// Demo user credentials
const DEMO_ADMIN = {
  username: 'admin',
  email: 'admin@demo.com',
  password: 'admin123',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  permissions: {
    canCreateQueues: true,
    canManageUsers: true,
    canViewAllProjects: true,
    canModifySystemSettings: true,
    maxConcurrentProjects: 10
  },
  status: 'active',
  availability: 'available'
};

const DEMO_WORKER = {
  username: 'worker',
  email: 'worker@demo.com',
  password: 'worker123',
  firstName: 'Demo',
  lastName: 'Worker',
  role: 'worker',
  permissions: {
    canCreateQueues: false,
    canManageUsers: false,
    canViewAllProjects: true,
    canModifySystemSettings: false,
    maxConcurrentProjects: 3
  },
  status: 'active',
  availability: 'available'
};

async function setupDemo() {
  try {
    console.log('🚀 Setting up demo users for Queue Management System...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/queue_management_db';
    console.log(`📡 Connecting to MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: DEMO_ADMIN.email });
    if (existingAdmin) {
      console.log('⚠️  Demo admin user already exists!');
      console.log('📧 Email: admin@demo.com');
      console.log('🔑 Password: admin123\n');
    } else {
      // Create admin user
      const admin = await User.create(DEMO_ADMIN);
      console.log('✅ Demo admin user created successfully!');
      console.log('📧 Email: admin@demo.com');
      console.log('🔑 Password: admin123\n');
    }

    // Check if worker already exists
    const existingWorker = await User.findOne({ email: DEMO_WORKER.email });
    if (existingWorker) {
      console.log('⚠️  Demo worker user already exists!');
      console.log('📧 Email: worker@demo.com');
      console.log('🔑 Password: worker123\n');
    } else {
      // Create worker user
      const worker = await User.create(DEMO_WORKER);
      console.log('✅ Demo worker user created successfully!');
      console.log('📧 Email: worker@demo.com');
      console.log('🔑 Password: worker123\n');
    }

    console.log('🎉 Demo setup complete!');
    console.log('\n📝 Demo Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 ADMIN USER:');
    console.log('   Email: admin@demo.com');
    console.log('   Password: admin123');
    console.log('   Role: Administrator (full access)');
    console.log('\n👤 WORKER USER:');
    console.log('   Email: worker@demo.com');
    console.log('   Password: worker123');
    console.log('   Role: Worker (limited access)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🌐 You can now login to the system at: http://localhost:3000');
    console.log('📖 Use either set of credentials to test different user roles.\n');

  } catch (error) {
    console.error('❌ Error setting up demo:', error);
    
    if (error.code === 'ENOTFOUND' || error.name === 'MongoNetworkError') {
      console.log('\n💡 MongoDB Connection Issue:');
      console.log('   1. Make sure MongoDB is installed and running');
      console.log('   2. Check if MongoDB is running on localhost:27017');
      console.log('   3. Or update MONGODB_URI in .env file');
    }
    
    if (error.code === 11000) {
      console.log('\n💡 User already exists - you can use existing credentials');
    }
  } finally {
    await mongoose.connection.close();
  }
}

// Run the setup
setupDemo();

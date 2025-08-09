#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createTestUsers() {
  console.log('🔧 Creating test users...');
  
  const users = [
    {
      username: 'superadmin',
      email: 'superadmin@test.com',
      password: 'password123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      status: 'active'
    },
    {
      username: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
      status: 'active'
    },
    {
      username: 'subadmin',
      email: 'subadmin@test.com',
      password: 'password123',
      firstName: 'Sub',
      lastName: 'Admin',
      role: 'sub_admin',
      status: 'active'
    },
    {
      username: 'user',
      email: 'user@test.com',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
      role: 'user',
      status: 'active'
    }
  ];

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { username: userData.username },
          { email: userData.email }
        ]
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.username} already exists - skipping`);
        continue;
      }

      // Create user (password will be hashed by the model's pre-save hook)
      const user = new User({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await user.save();
      console.log(`✅ Created user: ${userData.username} (${userData.role})`);
      
    } catch (error) {
      console.error(`❌ Error creating user ${userData.username}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 SEEDING DATABASE WITH TEST USERS');
  console.log('====================================');
  console.log('');

  try {
    await connectDatabase();
    await createTestUsers();
    
    console.log('');
    console.log('✅ Database seeding completed!');
    console.log('');
    console.log('🔑 TEST CREDENTIALS:');
    console.log('Username: admin');
    console.log('Password: password123');
    console.log('');
    console.log('Other available accounts:');
    console.log('- superadmin / password123 (Super Admin)');
    console.log('- subadmin / password123 (Sub Admin)');
    console.log('- user / password123 (Regular User)');
    console.log('');
    console.log('🌐 Now you can login at: http://localhost:3001');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
  }
}

// Run the seeding
main();

#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function resetUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Delete all existing users
    console.log('🗑️ Removing all existing users...');
    await User.deleteMany({});
    console.log('✅ All users removed');

    // Create new users
    console.log('\n🔧 Creating fresh test users...');
    
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
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created user: ${userData.username} (${userData.role})`);
    }

    console.log('\n✅ Database reset completed!');
    console.log('\n🔑 TEST CREDENTIALS:');
    console.log('Username: admin');
    console.log('Password: password123');
    console.log('\nOther available accounts:');
    console.log('- superadmin / password123 (Super Admin)');
    console.log('- subadmin / password123 (Sub Admin)');
    console.log('- user / password123 (Regular User)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
  }
}

resetUsers();

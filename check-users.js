#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({}).select('username email role status');
    
    console.log('\n📋 Users in database:');
    console.log('===================');
    
    if (users.length === 0) {
      console.log('❌ No users found in database!');
      console.log('Run: node seed-database.js to create test users');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log('');
      });
    }

    // Test password checking
    if (users.length > 0) {
      const adminUser = users.find(u => u.username === 'admin');
      if (adminUser) {
        console.log('🔍 Testing password for admin user...');
        const fullUser = await User.findById(adminUser._id).select('+password');
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare('password123', fullUser.password);
        console.log(`Password validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed');
  }
}

checkUsers();

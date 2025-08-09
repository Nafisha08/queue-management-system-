const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { validateUserLogin, validateUserRegistration } = require('../middleware/validation');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateUserLogin, catchAsync(async (req, res, next) => {
  const { identifier, password } = req.body;

  // For mock database, create test users
  if (process.env.USE_MOCK_DB === 'true') {
    const testUsers = [
      {
        _id: '507f1f77bcf86cd799439011',
        username: 'superadmin',
        email: 'superadmin@test.com',
        password: await bcrypt.hash('password123', 12),
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
        status: 'active'
      },
      {
        _id: '507f1f77bcf86cd799439012',
        username: 'admin',
        email: 'admin@test.com',
        password: await bcrypt.hash('password123', 12),
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        status: 'active'
      },
      {
        _id: '507f1f77bcf86cd799439013',
        username: 'subadmin',
        email: 'subadmin@test.com',
        password: await bcrypt.hash('password123', 12),
        firstName: 'Sub',
        lastName: 'Admin',
        role: 'sub_admin',
        status: 'active'
      },
      {
        _id: '507f1f77bcf86cd799439014',
        username: 'user',
        email: 'user@test.com',
        password: await bcrypt.hash('password123', 12),
        firstName: 'Regular',
        lastName: 'User',
        role: 'user',
        status: 'active'
      }
    ];

    // Find user by username or email
    const user = testUsers.find(u => 
      u.username === identifier || u.email === identifier
    );

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } else {
    // Real database logic
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier }
      ]
    }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if account is locked
    if (user.isAccountLocked) {
      return next(new AppError('Account is locked due to too many failed login attempts', 401));
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Handle failed login attempt
      await user.incrementLoginAttempts();
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if user is active
    if (user.status !== 'active') {
      return next(new AppError('Account is not active', 401));
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove sensitive data from response
    user.password = undefined;
    user.loginAttempts = undefined;
    user.lockUntil = undefined;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  }
}));

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public (but may be restricted in production)
 */
router.post('/register', validateUserRegistration, catchAsync(async (req, res, next) => {
  if (process.env.USE_MOCK_DB === 'true') {
    return res.json({
      success: false,
      message: 'Registration not available in mock database mode. Use predefined test accounts.'
    });
  }

  const { username, email, password, firstName, lastName, role = 'user' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existingUser) {
    return next(new AppError('User already exists with this username or email', 400));
  }

  // Create new user
  const user = await User.create({
    username,
    email,
    password,
    firstName,
    lastName,
    role
  });

  // Generate JWT token
  const token = jwt.sign(
    { 
      id: user._id, 
      username: user.username, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // Remove password from response
  user.password = undefined;

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      token
    }
  });
}));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', require('../middleware/auth').protect, catchAsync(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
}));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (mainly for token blacklisting if implemented)
 * @access  Private
 */
router.post('/logout', require('../middleware/auth').protect, catchAsync(async (req, res) => {
  // In a production app, you might want to blacklist the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

module.exports = router;

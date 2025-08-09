const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserLogin,
  validateUserPreferences,
  validatePasswordChange,
  validateApiKey
} = require('../middleware/validation');

const router = express.Router();

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * @desc    Register user
 * @route   POST /api/v1/users/register
 * @access  Public
 */
router.post('/register', validateUserRegistration, async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    const token = signToken(user._id);
    
    res.status(201).json({
      success: true,
      data: user,
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Login user
 * @route   POST /api/v1/users/login
 * @access  Public
 */
router.post('/login', validateUserLogin, async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    
    const user = await User.authenticate(identifier, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    const token = signToken(user._id);
    
    res.status(200).json({
      success: true,
      data: user,
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/users/me
 * @access  Private
 */
router.get('/me', protect, async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/me
 * @access  Private
 */
router.put('/me', protect, async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      profile: req.body.profile,
      preferences: req.body.preferences,
      availability: req.body.availability
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => {
      if (fieldsToUpdate[key] === undefined) {
        delete fieldsToUpdate[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Update user preferences
 * @route   PUT /api/v1/users/me/preferences
 * @access  Private
 */
router.put('/me/preferences', protect, validateUserPreferences, async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      { preferences: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user.preferences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Change password
 * @route   PUT /api/v1/users/me/password
 * @access  Private
 */
router.put('/me/password', protect, validatePasswordChange, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password field
    const user = await User.findById(req.user._id).select('+password');
    
    // Check current password
    const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get all users
 * @route   GET /api/v1/users
 * @access  Private (Admin/Manager)
 */
router.get('/', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { role, status, department, page = 1, limit = 10 } = req.query;
    
    let query = { archived: false };
    
    if (role) query.role = role;
    if (status) query.status = status;
    if (department) query['profile.department'] = department;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get user by ID
 * @route   GET /api/v1/users/:id
 * @access  Private
 */
router.get('/:id', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Users can view their own profile, admins and managers can view others
    if (req.user._id.toString() !== req.params.id && 
        !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Update user (Admin only)
 * @route   PUT /api/v1/users/:id
 * @access  Private (Admin)
 */
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Generate API key
 * @route   POST /api/v1/users/me/api-keys
 * @access  Private
 */
router.post('/me/api-keys', protect, validateApiKey, async (req, res, next) => {
  try {
    const { name, permissions, expiresIn } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // Set expiration date
    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
      expiresAt = new Date();
      switch (expiresIn) {
        case '1h':
          expiresAt.setHours(expiresAt.getHours() + 1);
          break;
        case '24h':
          expiresAt.setDate(expiresAt.getDate() + 1);
          break;
        case '7d':
          expiresAt.setDate(expiresAt.getDate() + 7);
          break;
        case '30d':
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          break;
        case '90d':
          expiresAt.setMonth(expiresAt.getMonth() + 3);
          break;
        case '1y':
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          break;
      }
    }
    
    const crypto = require('crypto');
    const key = crypto.randomBytes(32).toString('hex');
    
    user.apiKeys.push({
      name,
      key,
      permissions: permissions || [],
      expiresAt
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      data: {
        name,
        key,
        permissions: permissions || [],
        expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get user API keys
 * @route   GET /api/v1/users/me/api-keys
 * @access  Private
 */
router.get('/me/api-keys', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Return API keys without the actual key value
    const apiKeys = user.apiKeys.map(key => ({
      _id: key._id,
      name: key.name,
      permissions: key.permissions,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
      active: key.active
    }));
    
    res.status(200).json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Revoke API key
 * @route   DELETE /api/v1/users/me/api-keys/:keyId
 * @access  Private
 */
router.delete('/me/api-keys/:keyId', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const apiKey = user.apiKeys.id(req.params.keyId);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    apiKey.active = false;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get available workers
 * @route   GET /api/v1/users/workers/available
 * @access  Private (Manager/Admin)
 */
router.get('/workers/available', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { maxWorkload = 80 } = req.query;
    
    const workers = await User.findAvailableWorkers(parseInt(maxWorkload));
    
    res.status(200).json({
      success: true,
      data: workers
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

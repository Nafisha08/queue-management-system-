const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check for token in cookies (if using cookie-based auth)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select('+loginAttempts +lockUntil');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user account is locked
    if (user.isAccountLocked) {
      return res.status(401).json({
        success: false,
        error: 'Account is locked due to too many failed login attempts'
      });
    }

    // Check if user is active
    if (user.status === 'suspended') {
      return res.status(401).json({
        success: false,
        error: 'Account is suspended'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

/**
 * Grant access to specific roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

/**
 * Check specific permissions
 * @param {string} permission - Permission to check
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    const user = req.user;
    
    // Admin has all permissions
    if (user.role === 'admin') {
      return next();
    }

    // Check specific permission
    if (!user.permissions[permission]) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (user && user.status !== 'suspended' && !user.isAccountLocked) {
      req.user = user;
    }
  } catch (error) {
    // Ignore token errors for optional auth
  }

  next();
};

/**
 * API Key authentication
 */
const apiKeyAuth = async (req, res, next) => {
  let apiKey;

  // Check for API key in headers
  if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  } else if (req.query.api_key) {
    apiKey = req.query.api_key;
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }

  try {
    // Find user with this API key
    const user = await User.findOne({
      'apiKeys.key': apiKey,
      'apiKeys.active': true,
      status: { $ne: 'suspended' }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Find the specific API key
    const keyObj = user.apiKeys.find(k => k.key === apiKey && k.active);
    
    if (!keyObj) {
      return res.status(401).json({
        success: false,
        error: 'API key not found or inactive'
      });
    }

    // Check if API key is expired
    if (keyObj.expiresAt && keyObj.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'API key expired'
      });
    }

    // Update last used timestamp
    keyObj.lastUsed = new Date();
    await user.save();

    // Set user context
    req.user = user;
    req.apiKey = keyObj;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'API key authentication failed'
    });
  }
};

module.exports = {
  protect,
  authorize,
  requirePermission,
  optionalAuth,
  apiKeyAuth
};

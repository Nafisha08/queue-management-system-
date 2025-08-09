const Token = require('../models/Token');
const Customer = require('../models/Customer');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/APIFeatures');
const logger = require('../utils/logger');

/**
 * Generate a new token
 */
const generateToken = catchAsync(async (req, res, next) => {
  const { customerId, departmentId, serviceType, priority, scheduledTime } = req.body;

  // Verify customer exists
  const customer = await Customer.findById(customerId);
  if (!customer) {
    return next(new AppError('Customer not found', 404));
  }

  // Verify department exists and is active
  const department = await Department.findById(departmentId);
  if (!department || !department.isActive) {
    return next(new AppError('Department not found or inactive', 404));
  }

  // Check if department is open
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const todayHours = department.operatingHours.find(oh => oh.day === currentDay);
  if (!todayHours || !todayHours.isOpen) {
    return next(new AppError('Department is closed today', 400));
  }

  const openTime = todayHours.openTime.split(':');
  const closeTime = todayHours.closeTime.split(':');
  const openMinutes = parseInt(openTime[0]) * 60 + parseInt(openTime[1]);
  const closeMinutes = parseInt(closeTime[0]) * 60 + parseInt(closeTime[1]);

  if (currentTime < openMinutes || currentTime > closeMinutes) {
    return next(new AppError('Department is currently closed', 400));
  }

  // Check daily token limit
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const tokensToday = await Token.countDocuments({
    department: departmentId,
    createdAt: { $gte: startOfDay },
    status: { $ne: 'cancelled' }
  });

  if (tokensToday >= department.maxTokensPerDay) {
    return next(new AppError('Daily token limit reached', 400));
  }

  // Generate token number
  const tokenNumber = await generateTokenNumber(departmentId, serviceType);

  // Create token
  const token = await Token.create({
    tokenNumber,
    customer: customerId,
    department: departmentId,
    serviceType,
    priority: priority || 'normal',
    scheduledTime,
    generatedBy: req.user._id,
    estimatedWaitTime: await calculateEstimatedWaitTime(departmentId, priority || 'normal')
  });

  await token.populate(['customer', 'department', 'generatedBy']);

  // Update customer token history
  await Customer.findByIdAndUpdate(customerId, {
    $push: {
      tokenHistory: {
        tokenId: token._id,
        tokenNumber: token.tokenNumber,
        department: departmentId,
        serviceType,
        generatedAt: new Date()
      }
    }
  });

  logger.info(`Token ${token.tokenNumber} generated for customer ${customer.name}`);

  res.status(201).json({
    success: true,
    message: 'Token generated successfully',
    data: {
      token,
      estimatedWaitTime: token.estimatedWaitTime,
      position: await getQueuePosition(token._id)
    }
  });
});

/**
 * Get all tokens with filtering and pagination
 */
const getTokens = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Token.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Add populate
  features.query = features.query.populate([
    { path: 'customer', select: 'name phone email' },
    { path: 'department', select: 'name' },
    { path: 'counter', select: 'name number' },
    { path: 'generatedBy', select: 'name' }
  ]);

  const tokens = await features.query;
  const total = await Token.countDocuments();

  res.json({
    success: true,
    results: tokens.length,
    total,
    data: { tokens }
  });
});

/**
 * Get token by ID
 */
const getToken = catchAsync(async (req, res, next) => {
  const token = await Token.findById(req.params.tokenId).populate([
    { path: 'customer', select: 'name phone email' },
    { path: 'department', select: 'name' },
    { path: 'counter', select: 'name number' },
    { path: 'generatedBy', select: 'name' },
    { path: 'calledBy', select: 'name' },
    { path: 'servedBy', select: 'name' }
  ]);

  if (!token) {
    return next(new AppError('Token not found', 404));
  }

  res.json({
    success: true,
    data: { token }
  });
});

/**
 * Call token to counter
 */
const callToken = catchAsync(async (req, res, next) => {
  const { tokenId } = req.params;
  const { counterId } = req.body;

  const token = await Token.findById(tokenId);
  if (!token) {
    return next(new AppError('Token not found', 404));
  }

  if (token.status !== 'waiting') {
    return next(new AppError('Token is not in waiting status', 400));
  }

  // Verify counter exists and is active
  const counter = await Counter.findById(counterId);
  if (!counter || counter.status !== 'active') {
    return next(new AppError('Counter not available', 400));
  }

  // Update token
  token.status = 'called';
  token.counter = counterId;
  token.calledAt = new Date();
  token.calledBy = req.user._id;

  await token.save();

  logger.info(`Token ${token.tokenNumber} called to counter ${counter.name}`);

  res.json({
    success: true,
    message: 'Token called to counter',
    data: { token }
  });
});

/**
 * Start serving a token
 */
const serveToken = catchAsync(async (req, res, next) => {
  const { tokenId } = req.params;
  const { counterId } = req.body;

  const token = await Token.findById(tokenId);
  if (!token) {
    return next(new AppError('Token not found', 404));
  }

  if (token.status !== 'called') {
    return next(new AppError('Token must be called first', 400));
  }

  // Update token
  token.status = 'serving';
  token.servedAt = new Date();
  token.servedBy = req.user._id;

  await token.save();

  logger.info(`Token ${token.tokenNumber} service started`);

  res.json({
    success: true,
    message: 'Token service started',
    data: { token }
  });
});

/**
 * Complete token service
 */
const completeToken = catchAsync(async (req, res, next) => {
  const { tokenId } = req.params;
  const { completionNotes, rating } = req.body;

  const token = await Token.findById(tokenId);
  if (!token) {
    return next(new AppError('Token not found', 404));
  }

  if (token.status !== 'serving') {
    return next(new AppError('Token is not being served', 400));
  }

  // Calculate service time
  const serviceTime = token.servedAt ? 
    Math.round((new Date() - token.servedAt) / 1000 / 60) : 0; // in minutes

  // Update token
  token.status = 'completed';
  token.completedAt = new Date();
  token.serviceTime = serviceTime;
  token.completionNotes = completionNotes;
  token.rating = rating;

  await token.save();

  // Update customer statistics
  await updateCustomerStats(token.customer, 'completed');

  // Update department statistics
  await updateDepartmentStats(token.department, 'completed', serviceTime);

  logger.info(`Token ${token.tokenNumber} completed`);

  res.json({
    success: true,
    message: 'Token service completed',
    data: { token }
  });
});

/**
 * Cancel a token
 */
const cancelToken = catchAsync(async (req, res, next) => {
  const { tokenId } = req.params;
  const { reason } = req.body;

  const token = await Token.findById(tokenId);
  if (!token) {
    return next(new AppError('Token not found', 404));
  }

  if (!['waiting', 'called'].includes(token.status)) {
    return next(new AppError('Token cannot be cancelled', 400));
  }

  // Update token
  token.status = 'cancelled';
  token.cancelledAt = new Date();
  token.cancelledBy = req.user._id;
  token.cancellationReason = reason;

  await token.save();

  // Update customer statistics
  await updateCustomerStats(token.customer, 'cancelled');

  logger.info(`Token ${token.tokenNumber} cancelled: ${reason}`);

  res.json({
    success: true,
    message: 'Token cancelled',
    data: { token }
  });
});

/**
 * Transfer token to another department/counter
 */
const transferToken = catchAsync(async (req, res, next) => {
  const { tokenId } = req.params;
  const { targetDepartmentId, targetCounterId, reason } = req.body;

  const token = await Token.findById(tokenId);
  if (!token) {
    return next(new AppError('Token not found', 404));
  }

  if (token.status === 'completed' || token.status === 'cancelled') {
    return next(new AppError('Token cannot be transferred', 400));
  }

  const oldDepartment = token.department;
  const oldCounter = token.counter;

  // Update token
  token.department = targetDepartmentId;
  token.counter = targetCounterId;
  token.status = 'waiting'; // Reset to waiting in new location
  
  // Add to transfer history
  token.transferHistory.push({
    from: { department: oldDepartment, counter: oldCounter },
    to: { department: targetDepartmentId, counter: targetCounterId },
    reason,
    transferredBy: req.user._id,
    transferredAt: new Date()
  });

  await token.save();

  logger.info(`Token ${token.tokenNumber} transferred`);

  res.json({
    success: true,
    message: 'Token transferred successfully',
    data: { token }
  });
});

/**
 * Get department queue status
 */
const getDepartmentQueue = catchAsync(async (req, res, next) => {
  const { departmentId } = req.params;

  const queueData = await Token.aggregate([
    {
      $match: {
        department: departmentId,
        status: { $in: ['waiting', 'called', 'serving'] }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        tokens: { $push: '$$ROOT' }
      }
    }
  ]);

  const totalWaiting = queueData.find(q => q._id === 'waiting')?.count || 0;
  const totalCalled = queueData.find(q => q._id === 'called')?.count || 0;
  const totalServing = queueData.find(q => q._id === 'serving')?.count || 0;

  res.json({
    success: true,
    data: {
      departmentId,
      queue: {
        waiting: totalWaiting,
        called: totalCalled,
        serving: totalServing,
        total: totalWaiting + totalCalled + totalServing
      },
      tokens: queueData
    }
  });
});

/**
 * Get tokens for a specific customer
 */
const getCustomerTokens = catchAsync(async (req, res, next) => {
  const { customerId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  let filter = { customer: customerId };
  if (status) {
    filter.status = status;
  }

  const tokens = await Token.find(filter)
    .populate([
      { path: 'department', select: 'name' },
      { path: 'counter', select: 'name number' }
    ])
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Token.countDocuments(filter);

  res.json({
    success: true,
    results: tokens.length,
    total,
    data: { tokens }
  });
});

/**
 * Get currently serving token for a counter
 */
const getCurrentTokenForCounter = catchAsync(async (req, res, next) => {
  const { counterId } = req.params;

  const token = await Token.findOne({
    counter: counterId,
    status: 'serving'
  }).populate([
    { path: 'customer', select: 'name phone' },
    { path: 'department', select: 'name' }
  ]);

  res.json({
    success: true,
    data: { token }
  });
});

// Helper functions
const generateTokenNumber = async (departmentId, serviceType) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const count = await Token.countDocuments({
    department: departmentId,
    createdAt: {
      $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    }
  });

  const servicePrefix = serviceType ? serviceType.charAt(0).toUpperCase() : 'T';
  return `${servicePrefix}${dateStr}${String(count + 1).padStart(3, '0')}`;
};

const calculateEstimatedWaitTime = async (departmentId, priority) => {
  // Get average service time from completed tokens
  const avgServiceTime = await Token.aggregate([
    {
      $match: {
        department: departmentId,
        status: 'completed',
        serviceTime: { $exists: true, $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        averageTime: { $avg: '$serviceTime' }
      }
    }
  ]);

  const baseTime = avgServiceTime.length > 0 ? avgServiceTime[0].averageTime : 10; // Default 10 minutes

  // Get queue position
  const waitingCount = await Token.countDocuments({
    department: departmentId,
    status: 'waiting',
    priority: { $lte: priority === 'high' ? 'high' : priority === 'urgent' ? 'urgent' : 'normal' }
  });

  return Math.round(waitingCount * baseTime);
};

const getQueuePosition = async (tokenId) => {
  const token = await Token.findById(tokenId);
  if (!token) return 0;

  const position = await Token.countDocuments({
    department: token.department,
    status: 'waiting',
    $or: [
      { priority: 'urgent' },
      { priority: 'high', createdAt: { $lt: token.createdAt } },
      { priority: 'normal', createdAt: { $lt: token.createdAt } }
    ]
  });

  return position + 1;
};

const updateCustomerStats = async (customerId, action) => {
  const update = {};
  update[`statistics.tokens.${action}`] = 1;
  
  await Customer.findByIdAndUpdate(customerId, {
    $inc: update
  });
};

const updateDepartmentStats = async (departmentId, action, serviceTime = 0) => {
  const update = {};
  update[`statistics.tokens.${action}`] = 1;
  
  if (action === 'completed' && serviceTime) {
    update['statistics.averageServiceTime'] = serviceTime;
  }

  await Department.findByIdAndUpdate(departmentId, {
    $inc: update
  });
};

// Additional controller methods would go here...
const getTokenAnalytics = catchAsync(async (req, res, next) => {
  // Implementation for analytics
  res.json({ success: true, data: { message: 'Analytics endpoint - to be implemented' } });
});

const getDailyTokenReport = catchAsync(async (req, res, next) => {
  // Implementation for daily reports
  res.json({ success: true, data: { message: 'Daily report endpoint - to be implemented' } });
});

const updateTokenPriority = catchAsync(async (req, res, next) => {
  // Implementation for priority updates
  res.json({ success: true, data: { message: 'Priority update endpoint - to be implemented' } });
});

const getDisplayInfo = catchAsync(async (req, res, next) => {
  // Implementation for public display
  res.json({ success: true, data: { message: 'Display info endpoint - to be implemented' } });
});

module.exports = {
  generateToken,
  getTokens,
  getToken,
  callToken,
  serveToken,
  completeToken,
  cancelToken,
  transferToken,
  getDepartmentQueue,
  getCustomerTokens,
  getCurrentTokenForCounter,
  getTokenAnalytics,
  getDailyTokenReport,
  updateTokenPriority,
  getDisplayInfo
};

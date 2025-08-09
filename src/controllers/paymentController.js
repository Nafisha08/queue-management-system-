const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Token = require('../models/Token');
const { validateObjectId } = require('../utils/validation');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Create a new payment
exports.createPayment = catchAsync(async (req, res, next) => {
  const {
    customerId,
    tokenId,
    amount,
    currency = 'INR',
    paymentMethod = 'cash',
    paymentDetails = {},
    description,
    serviceType,
    departmentId,
    counterId,
    charges = [],
    invoice = {}
  } = req.body;

  // Validate required fields
  if (!customerId || !amount) {
    return next(new AppError('Customer ID and amount are required', 400));
  }

  // Validate customer exists
  const customer = await Customer.findById(customerId);
  if (!customer) {
    return next(new AppError('Customer not found', 404));
  }

  // Validate token if provided
  let token = null;
  if (tokenId) {
    token = await Token.findById(tokenId);
    if (!token) {
      return next(new AppError('Token not found', 404));
    }
  }

  // Calculate total charges
  let totalCharges = 0;
  if (charges.length > 0) {
    charges.forEach(charge => {
      if (charge.chargeType === 'discount') {
        totalCharges -= charge.amount;
      } else {
        totalCharges += charge.amount;
      }
    });
  }

  // Create payment
  const payment = new Payment({
    customer: customerId,
    token: tokenId,
    amount,
    currency,
    paymentMethod,
    paymentDetails,
    description,
    serviceType: serviceType || 'token_service',
    department: departmentId,
    counter: counterId,
    charges,
    invoice,
    createdBy: req.user._id,
    processedBy: paymentMethod === 'cash' ? req.user._id : undefined
  });

  // Set cash payment details if cash payment
  if (paymentMethod === 'cash') {
    if (!payment.paymentDetails.cash) {
      payment.paymentDetails.cash = {};
    }
    payment.paymentDetails.cash.receivedBy = req.user._id;
    payment.status = 'completed';
    payment.completedAt = new Date();
  }

  await payment.save();

  // Update token payment status if token provided
  if (token) {
    token.payment.required = true;
    token.payment.amount = amount;
    token.payment.currency = currency;
    token.payment.status = payment.status === 'completed' ? 'completed' : 'pending';
    token.payment.method = paymentMethod;
    token.payment.paymentId = payment._id;
    token.payment.totalAmount = payment.totalAmount;
    
    if (payment.status === 'completed') {
      token.payment.paidAt = payment.completedAt;
      token.payment.transactionId = payment.paymentId;
      token.payment.receiptNumber = payment.receipt.receiptNumber;
    }
    
    await token.save();
  }

  // Update customer payment summary
  if (payment.status === 'completed') {
    customer.paymentSummary.totalPaid += payment.totalAmount;
    customer.paymentSummary.totalTransactions += 1;
    customer.paymentSummary.averageTransactionAmount = 
      customer.paymentSummary.totalPaid / customer.paymentSummary.totalTransactions;
    customer.paymentSummary.lastTransactionDate = payment.completedAt;
    customer.paymentSummary.paymentMethodUsage[paymentMethod] += 1;
    customer.lastPaymentDate = payment.completedAt;
    
    await customer.save();
  }

  await payment.populate('customer', 'firstName lastName phone');
  if (token) {
    await payment.populate('token', 'tokenNumber displayNumber');
  }

  res.status(201).json({
    success: true,
    message: 'Payment created successfully',
    data: payment
  });
});

// Process UPI payment
exports.processUpiPayment = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const {
    upiId,
    transactionId,
    vpa,
    pspName,
    merchantTransactionId,
    gatewayResponse = {}
  } = req.body;

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (payment.paymentMethod !== 'upi') {
    return next(new AppError('This payment is not a UPI payment', 400));
  }

  if (payment.status !== 'pending') {
    return next(new AppError('Payment is not in pending status', 400));
  }

  // Update UPI details
  const upiDetails = {
    upiId,
    transactionId,
    vpa,
    pspName,
    merchantTransactionId
  };

  // Process payment
  await payment.processPayment(req.user._id);

  // Complete payment with UPI details
  await payment.completePayment({ upi: upiDetails });

  // Update gateway information if provided
  if (Object.keys(gatewayResponse).length > 0) {
    payment.gateway.gatewayResponse = gatewayResponse;
    await payment.save();
  }

  // Update related token
  if (payment.token) {
    const token = await Token.findById(payment.token);
    if (token) {
      token.payment.status = 'completed';
      token.payment.paidAt = payment.completedAt;
      token.payment.transactionId = transactionId;
      token.payment.receiptNumber = payment.receipt.receiptNumber;
      await token.save();
    }
  }

  // Update customer payment summary
  const customer = await Customer.findById(payment.customer);
  if (customer) {
    customer.paymentSummary.totalPaid += payment.totalAmount;
    customer.paymentSummary.totalTransactions += 1;
    customer.paymentSummary.averageTransactionAmount = 
      customer.paymentSummary.totalPaid / customer.paymentSummary.totalTransactions;
    customer.paymentSummary.lastTransactionDate = payment.completedAt;
    customer.paymentSummary.paymentMethodUsage.upi += 1;
    customer.lastPaymentDate = payment.completedAt;
    await customer.save();
  }

  res.json({
    success: true,
    message: 'UPI payment processed successfully',
    data: payment
  });
});

// Process cash payment
exports.processCashPayment = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const {
    denomination = [],
    changeGiven = 0,
    receivedAmount
  } = req.body;

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (payment.paymentMethod !== 'cash') {
    return next(new AppError('This payment is not a cash payment', 400));
  }

  if (payment.status !== 'pending' && payment.status !== 'processing') {
    return next(new AppError('Payment cannot be processed in current status', 400));
  }

  // Validate received amount
  const calculatedAmount = denomination.reduce((sum, denom) => sum + (denom.note * denom.count), 0);
  if (receivedAmount && Math.abs(calculatedAmount - receivedAmount) > 0.01) {
    return next(new AppError('Denomination breakdown does not match received amount', 400));
  }

  const totalReceived = receivedAmount || calculatedAmount;
  if (totalReceived < payment.totalAmount) {
    return next(new AppError('Received amount is less than payment amount', 400));
  }

  // Update cash details
  const cashDetails = {
    receivedBy: req.user._id,
    denomination,
    changeGiven: totalReceived - payment.totalAmount
  };

  // Process and complete payment
  await payment.processPayment(req.user._id);
  await payment.completePayment({ cash: cashDetails });

  // Update related token
  if (payment.token) {
    const token = await Token.findById(payment.token);
    if (token) {
      token.payment.status = 'completed';
      token.payment.paidAt = payment.completedAt;
      token.payment.receiptNumber = payment.receipt.receiptNumber;
      await token.save();
    }
  }

  // Update customer payment summary
  const customer = await Customer.findById(payment.customer);
  if (customer) {
    customer.paymentSummary.totalPaid += payment.totalAmount;
    customer.paymentSummary.totalTransactions += 1;
    customer.paymentSummary.averageTransactionAmount = 
      customer.paymentSummary.totalPaid / customer.paymentSummary.totalTransactions;
    customer.paymentSummary.lastTransactionDate = payment.completedAt;
    customer.paymentSummary.paymentMethodUsage.cash += 1;
    customer.lastPaymentDate = payment.completedAt;
    await customer.save();
  }

  res.json({
    success: true,
    message: 'Cash payment processed successfully',
    data: {
      payment,
      changeGiven: cashDetails.changeGiven
    }
  });
});

// Get payment by ID
exports.getPayment = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;

  const payment = await Payment.findById(paymentId)
    .populate('customer', 'firstName lastName phone email')
    .populate('token', 'tokenNumber displayNumber status')
    .populate('department', 'name code')
    .populate('counter', 'name number')
    .populate('processedBy', 'firstName lastName')
    .populate('createdBy', 'firstName lastName');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.json({
    success: true,
    data: payment
  });
});

// Get payments with filtering and pagination
exports.getPayments = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    paymentMethod,
    customerId,
    startDate,
    endDate,
    departmentId,
    search
  } = req.query;

  // Build query
  const query = {};

  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (customerId) query.customer = customerId;
  if (departmentId) query.department = departmentId;

  if (startDate || endDate) {
    query.businessDate = {};
    if (startDate) query.businessDate.$gte = new Date(startDate);
    if (endDate) query.businessDate.$lte = new Date(endDate);
  }

  // Role-based filtering
  if (req.user.role === 'sub_admin') {
    // Sub admins can only see payments from their department
    if (req.user.department) {
      query.department = req.user.department;
    } else {
      return next(new AppError('Sub admin must be assigned to a department', 403));
    }
  }

  // Search functionality
  let searchQuery = query;
  if (search) {
    const customers = await Customer.find({
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    const customerIds = customers.map(c => c._id);

    searchQuery = {
      ...query,
      $or: [
        { paymentId: { $regex: search, $options: 'i' } },
        { customer: { $in: customerIds } },
        { 'invoice.invoiceNumber': { $regex: search, $options: 'i' } },
        { 'receipt.receiptNumber': { $regex: search, $options: 'i' } }
      ]
    };
  }

  const skip = (page - 1) * limit;

  const payments = await Payment.find(searchQuery)
    .populate('customer', 'firstName lastName phone')
    .populate('token', 'tokenNumber displayNumber')
    .populate('department', 'name code')
    .populate('counter', 'name number')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(searchQuery);

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    }
  });
});

// Get customer payment history
exports.getCustomerPayments = catchAsync(async (req, res, next) => {
  const { customerId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return next(new AppError('Customer not found', 404));
  }

  const payments = await Payment.findByCustomer(customerId, status)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments({ 
    customer: customerId, 
    ...(status && { status }) 
  });

  res.json({
    success: true,
    data: {
      customer: {
        id: customer._id,
        name: customer.fullName,
        phone: customer.phone,
        paymentSummary: customer.paymentSummary
      },
      payments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    }
  });
});

// Refund payment
exports.refundPayment = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const { amount, reason } = req.body;

  // Only super_admin and admin can process refunds
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return next(new AppError('Insufficient permissions to process refunds', 403));
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (!amount || !reason) {
    return next(new AppError('Refund amount and reason are required', 400));
  }

  if (amount > payment.totalAmount) {
    return next(new AppError('Refund amount cannot exceed payment amount', 400));
  }

  await payment.refundPayment(amount, reason, req.user._id);

  // Update related token
  if (payment.token) {
    const token = await Token.findById(payment.token);
    if (token) {
      token.payment.status = 'refunded';
      await token.save();
    }
  }

  res.json({
    success: true,
    message: 'Payment refunded successfully',
    data: payment
  });
});

// Get payment analytics
exports.getPaymentAnalytics = catchAsync(async (req, res, next) => {
  const { startDate, endDate, departmentId } = req.query;

  // Role-based access control
  if (req.user.role === 'sub_admin') {
    if (req.user.department) {
      req.query.departmentId = req.user.department;
    } else {
      return next(new AppError('Sub admin must be assigned to a department', 403));
    }
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Build match query
  const matchQuery = {
    businessDate: { $gte: start, $lte: end }
  };

  if (departmentId) {
    matchQuery.department = require('mongoose').Types.ObjectId(departmentId);
  }

  const analytics = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$businessDate' } },
          method: '$paymentMethod',
          status: '$status'
        },
        count: { $sum: 1 },
        revenue: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $group: {
        _id: { date: '$_id.date', method: '$_id.method' },
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count',
            revenue: '$revenue',
            avgAmount: '$avgAmount'
          }
        },
        totalCount: { $sum: '$count' },
        totalRevenue: { $sum: '$revenue' }
      }
    },
    { $sort: { '_id.date': 1, '_id.method': 1 } }
  ]);

  // Get summary statistics
  const summary = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        avgTransactionAmount: { $avg: '$amount' },
        paymentMethods: {
          $push: {
            method: '$paymentMethod',
            status: '$status',
            amount: '$amount'
          }
        }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      analytics,
      summary: summary[0] || {
        totalRevenue: 0,
        totalTransactions: 0,
        avgTransactionAmount: 0,
        paymentMethods: []
      },
      period: {
        startDate: start,
        endDate: end
      }
    }
  });
});

// Generate daily payment report
exports.getDailyReport = catchAsync(async (req, res, next) => {
  const { date } = req.query;
  const reportDate = date ? new Date(date) : new Date();

  // Role-based filtering
  const matchQuery = {
    businessDate: {
      $gte: new Date(reportDate.setHours(0, 0, 0, 0)),
      $lte: new Date(reportDate.setHours(23, 59, 59, 999))
    }
  };

  if (req.user.role === 'sub_admin' && req.user.department) {
    matchQuery.department = req.user.department;
  }

  const report = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          method: '$paymentMethod',
          status: '$status'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $group: {
        _id: '$_id.method',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalAmount: '$totalAmount',
            avgAmount: '$avgAmount'
          }
        },
        totalTransactions: { $sum: '$count' },
        totalRevenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  // Get hourly breakdown
  const hourlyReport = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          hour: { $hour: '$createdAt' },
          method: '$paymentMethod'
        },
        count: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.hour': 1 } }
  ]);

  res.json({
    success: true,
    data: {
      date: reportDate,
      summary: report,
      hourlyBreakdown: hourlyReport,
      generatedAt: new Date(),
      generatedBy: req.user._id
    }
  });
});

module.exports = exports;

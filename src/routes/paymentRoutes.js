const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const { paymentValidation } = require('../middleware/validation');
const AppError = require('../utils/AppError');

const router = express.Router();

// Apply authentication to all payment routes
router.use(protect);

/**
 * @route   POST /api/payments
 * @desc    Create a new payment
 * @access  Private (Admin, Sub Admin)
 * @body    {customerId, tokenId, amount, paymentMethod, paymentDetails, charges, invoice}
 */
router.post(
  '/',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentValidation.createPayment,
  paymentController.createPayment
);

/**
 * @route   GET /api/payments
 * @desc    Get all payments with filtering and pagination
 * @access  Private (All authenticated users)
 * @query   {page, limit, status, paymentMethod, customerId, startDate, endDate, departmentId, search}
 */
router.get(
  '/',
  paymentController.getPayments
);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get payment by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:paymentId',
  paymentValidation.getPaymentById,
  paymentController.getPayment
);

/**
 * @route   PUT /api/payments/:paymentId/upi/process
 * @desc    Process UPI payment
 * @access  Private (Admin, Sub Admin)
 * @body    {upiId, transactionId, vpa, pspName, merchantTransactionId, gatewayResponse}
 */
router.put(
  '/:paymentId/upi/process',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentValidation.processUpiPayment,
  paymentController.processUpiPayment
);

/**
 * @route   PUT /api/payments/:paymentId/cash/process
 * @desc    Process cash payment
 * @access  Private (Admin, Sub Admin)
 * @body    {denomination, changeGiven, receivedAmount}
 */
router.put(
  '/:paymentId/cash/process',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentValidation.processCashPayment,
  paymentController.processCashPayment
);

/**
 * @route   PUT /api/payments/:paymentId/refund
 * @desc    Refund a payment
 * @access  Private (Super Admin, Admin only)
 * @body    {amount, reason}
 */
router.put(
  '/:paymentId/refund',
  authorize(['super_admin', 'admin']),
  paymentValidation.refundPayment,
  paymentController.refundPayment
);

/**
 * @route   GET /api/payments/customer/:customerId
 * @desc    Get payment history for a customer
 * @access  Private (All authenticated users)
 * @query   {status, page, limit}
 */
router.get(
  '/customer/:customerId',
  paymentValidation.getCustomerPayments,
  paymentController.getCustomerPayments
);

/**
 * @route   GET /api/payments/analytics/summary
 * @desc    Get payment analytics and summary
 * @access  Private (Admin, Sub Admin)
 * @query   {startDate, endDate, departmentId}
 */
router.get(
  '/analytics/summary',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentController.getPaymentAnalytics
);

/**
 * @route   GET /api/payments/reports/daily
 * @desc    Generate daily payment report
 * @access  Private (Admin, Sub Admin)
 * @query   {date}
 */
router.get(
  '/reports/daily',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentController.getDailyReport
);

// Token-related payment routes

/**
 * @route   POST /api/payments/token/:tokenId/pay
 * @desc    Create payment for a specific token
 * @access  Private (Admin, Sub Admin)
 * @body    {amount, paymentMethod, paymentDetails, charges}
 */
router.post(
  '/token/:tokenId/pay',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentValidation.createTokenPayment,
  async (req, res, next) => {
    // Add tokenId to request body for processing
    req.body.tokenId = req.params.tokenId;
    
    // Get token to extract customer info
    const Token = require('../models/Token');
    const token = await Token.findById(req.params.tokenId).populate('customer');
    
    if (!token) {
      return next(new AppError('Token not found', 404));
    }
    
    // Add customer ID and other details
    req.body.customerId = token.customer._id;
    req.body.departmentId = token.department;
    req.body.counterId = token.counter;
    
    return paymentController.createPayment(req, res, next);
  }
);

/**
 * @route   GET /api/payments/token/:tokenId/status
 * @desc    Get payment status for a token
 * @access  Private (All authenticated users)
 */
router.get(
  '/token/:tokenId/status',
  paymentValidation.getTokenPaymentStatus,
  async (req, res, next) => {
    const { tokenId } = req.params;
    
    const Token = require('../models/Token');
    const token = await Token.findById(tokenId).populate('payment.paymentId');
    
    if (!token) {
      return next(new AppError('Token not found', 404));
    }
    
    res.json({
      success: true,
      data: {
        tokenId: token._id,
        tokenNumber: token.tokenNumber,
        payment: token.payment,
        paymentDetails: token.payment.paymentId || null
      }
    });
  }
);

// Quick payment methods for common scenarios

/**
 * @route   POST /api/payments/quick/cash
 * @desc    Quick cash payment processing
 * @access  Private (Admin, Sub Admin)
 * @body    {customerId, tokenId, amount, receivedAmount, description}
 */
router.post(
  '/quick/cash',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentValidation.quickCashPayment,
  async (req, res, next) => {
    const { customerId, tokenId, amount, receivedAmount, description } = req.body;
    
    // Calculate change
    const changeGiven = receivedAmount - amount;
    if (changeGiven < 0) {
      return next(new AppError('Received amount is less than payment amount', 400));
    }
    
    // Set up cash payment details
    req.body.paymentMethod = 'cash';
    req.body.paymentDetails = {
      cash: {
        receivedBy: req.user._id,
        changeGiven
      }
    };
    
    return paymentController.createPayment(req, res, next);
  }
);

/**
 * @route   POST /api/payments/quick/upi
 * @desc    Quick UPI payment initiation
 * @access  Private (Admin, Sub Admin)
 * @body    {customerId, tokenId, amount, upiId, description}
 */
router.post(
  '/quick/upi',
  authorize(['super_admin', 'admin', 'sub_admin']),
  paymentValidation.quickUpiPayment,
  async (req, res, next) => {
    const { customerId, tokenId, amount, upiId, description } = req.body;
    
    // Set up UPI payment details
    req.body.paymentMethod = 'upi';
    req.body.paymentDetails = {
      upi: {
        upiId
      }
    };
    
    return paymentController.createPayment(req, res, next);
  }
);

// Bulk payment operations

/**
 * @route   POST /api/payments/bulk/process
 * @desc    Process multiple payments at once
 * @access  Private (Super Admin, Admin only)
 * @body    {payments: [paymentId...], action: 'complete'|'cancel'}
 */
router.post(
  '/bulk/process',
  authorize(['super_admin', 'admin']),
  paymentValidation.bulkProcessPayments,
  async (req, res, next) => {
    const { payments, action } = req.body;
    
    try {
      const Payment = require('../models/Payment');
      const results = [];
      
      for (const paymentId of payments) {
        const payment = await Payment.findById(paymentId);
        if (!payment) continue;
        
        if (action === 'complete' && payment.status === 'pending') {
          await payment.completePayment();
          results.push({ paymentId, status: 'completed' });
        } else if (action === 'cancel' && payment.status === 'pending') {
          await payment.failPayment('Bulk cancelled by admin');
          results.push({ paymentId, status: 'cancelled' });
        } else {
          results.push({ paymentId, status: 'skipped', reason: 'Invalid status or action' });
        }
      }
      
      res.json({
        success: true,
        message: `Bulk ${action} operation completed`,
        data: {
          processed: results.filter(r => r.status !== 'skipped').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          results
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;

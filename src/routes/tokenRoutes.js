const express = require('express');
const tokenController = require('../controllers/tokenController');
const { protect, authorize } = require('../middleware/auth');
const { tokenValidation } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all token routes
router.use(protect);

/**
 * @route   POST /api/tokens
 * @desc    Generate a new token
 * @access  Private (Admin, Sub Admin)
 * @body    {customerId, departmentId, serviceType, priority, scheduledTime}
 */
router.post(
  '/',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.generateToken,
  tokenController.generateToken
);

/**
 * @route   GET /api/tokens
 * @desc    Get all tokens with filtering and pagination
 * @access  Private (All authenticated users)
 * @query   {page, limit, status, priority, departmentId, customerId, date, search}
 */
router.get(
  '/',
  tokenController.getTokens
);

/**
 * @route   GET /api/tokens/:tokenId
 * @desc    Get token by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:tokenId',
  tokenValidation.getTokenById,
  tokenController.getToken
);

/**
 * @route   PUT /api/tokens/:tokenId/call
 * @desc    Call a token to counter
 * @access  Private (Admin, Sub Admin)
 * @body    {counterId}
 */
router.put(
  '/:tokenId/call',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.callToken,
  tokenController.callToken
);

/**
 * @route   PUT /api/tokens/:tokenId/serve
 * @desc    Start serving a token
 * @access  Private (Admin, Sub Admin)
 * @body    {counterId, startTime}
 */
router.put(
  '/:tokenId/serve',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.serveToken,
  tokenController.serveToken
);

/**
 * @route   PUT /api/tokens/:tokenId/complete
 * @desc    Complete token service
 * @access  Private (Admin, Sub Admin)
 * @body    {completionNotes, rating}
 */
router.put(
  '/:tokenId/complete',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.completeToken,
  tokenController.completeToken
);

/**
 * @route   PUT /api/tokens/:tokenId/cancel
 * @desc    Cancel a token
 * @access  Private (Admin, Sub Admin)
 * @body    {reason}
 */
router.put(
  '/:tokenId/cancel',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.cancelToken,
  tokenController.cancelToken
);

/**
 * @route   PUT /api/tokens/:tokenId/transfer
 * @desc    Transfer token to another department/counter
 * @access  Private (Admin, Sub Admin)
 * @body    {targetDepartmentId, targetCounterId, reason}
 */
router.put(
  '/:tokenId/transfer',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.transferToken,
  tokenController.transferToken
);

/**
 * @route   GET /api/tokens/queue/:departmentId
 * @desc    Get queue status for a department
 * @access  Private (All authenticated users)
 */
router.get(
  '/queue/:departmentId',
  tokenController.getDepartmentQueue
);

/**
 * @route   GET /api/tokens/customer/:customerId
 * @desc    Get tokens for a specific customer
 * @access  Private (All authenticated users)
 * @query   {status, page, limit}
 */
router.get(
  '/customer/:customerId',
  tokenValidation.getCustomerTokens,
  tokenController.getCustomerTokens
);

/**
 * @route   GET /api/tokens/counter/:counterId/current
 * @desc    Get currently serving token for a counter
 * @access  Private (All authenticated users)
 */
router.get(
  '/counter/:counterId/current',
  tokenController.getCurrentTokenForCounter
);

/**
 * @route   GET /api/tokens/analytics/summary
 * @desc    Get token analytics and summary
 * @access  Private (Admin, Sub Admin)
 * @query   {startDate, endDate, departmentId}
 */
router.get(
  '/analytics/summary',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenController.getTokenAnalytics
);

/**
 * @route   GET /api/tokens/reports/daily
 * @desc    Generate daily token report
 * @access  Private (Admin, Sub Admin)
 * @query   {date, departmentId}
 */
router.get(
  '/reports/daily',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenController.getDailyTokenReport
);

/**
 * @route   PUT /api/tokens/:tokenId/priority
 * @desc    Update token priority
 * @access  Private (Admin, Sub Admin)
 * @body    {priority, reason}
 */
router.put(
  '/:tokenId/priority',
  authorize(['super_admin', 'admin', 'sub_admin']),
  tokenValidation.updateTokenPriority,
  tokenController.updateTokenPriority
);

/**
 * @route   GET /api/tokens/display/:departmentId
 * @desc    Get display information for department (for public displays)
 * @access  Public
 */
router.get(
  '/display/:departmentId',
  tokenController.getDisplayInfo
);

module.exports = router;

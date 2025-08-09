const express = require('express');
const counterController = require('../controllers/counterController');
const { protect, authorize } = require('../middleware/auth');
const { counterValidation } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all counter routes
router.use(protect);

/**
 * @route   POST /api/counters
 * @desc    Create a new counter
 * @access  Private (Super Admin, Admin only)
 * @body    {number, name, departmentId, serviceTypes, maxTokensPerHour}
 */
router.post(
  '/',
  authorize(['super_admin', 'admin']),
  counterValidation.createCounter,
  counterController.createCounter
);

/**
 * @route   GET /api/counters
 * @desc    Get all counters with filtering and pagination
 * @access  Private (All authenticated users)
 * @query   {page, limit, status, departmentId, search, sortBy}
 */
router.get(
  '/',
  counterController.getCounters
);

/**
 * @route   GET /api/counters/:counterId
 * @desc    Get counter by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:counterId',
  counterValidation.getCounterById,
  counterController.getCounter
);

/**
 * @route   PUT /api/counters/:counterId
 * @desc    Update counter
 * @access  Private (Super Admin, Admin only)
 * @body    {name, serviceTypes, maxTokensPerHour, hardwareConfig}
 */
router.put(
  '/:counterId',
  authorize(['super_admin', 'admin']),
  counterValidation.updateCounter,
  counterController.updateCounter
);

/**
 * @route   DELETE /api/counters/:counterId
 * @desc    Delete (soft delete) counter
 * @access  Private (Super Admin only)
 */
router.delete(
  '/:counterId',
  authorize(['super_admin']),
  counterValidation.deleteCounter,
  counterController.deleteCounter
);

/**
 * @route   PUT /api/counters/:counterId/status
 * @desc    Update counter status (active/inactive/maintenance)
 * @access  Private (Super Admin, Admin, Sub Admin)
 * @body    {status, reason}
 */
router.put(
  '/:counterId/status',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterValidation.updateCounterStatus,
  counterController.updateCounterStatus
);

/**
 * @route   POST /api/counters/:counterId/staff/assign
 * @desc    Assign staff to counter
 * @access  Private (Super Admin, Admin)
 * @body    {staffId, role, shift}
 */
router.post(
  '/:counterId/staff/assign',
  authorize(['super_admin', 'admin']),
  counterValidation.assignStaffToCounter,
  counterController.assignStaffToCounter
);

/**
 * @route   DELETE /api/counters/:counterId/staff/:staffId
 * @desc    Remove staff from counter
 * @access  Private (Super Admin, Admin)
 */
router.delete(
  '/:counterId/staff/:staffId',
  authorize(['super_admin', 'admin']),
  counterController.removeStaffFromCounter
);

/**
 * @route   GET /api/counters/:counterId/queue
 * @desc    Get current queue for counter
 * @access  Private (All authenticated users)
 */
router.get(
  '/:counterId/queue',
  counterController.getCounterQueue
);

/**
 * @route   PUT /api/counters/:counterId/token/next
 * @desc    Call next token to counter
 * @access  Private (Admin, Sub Admin)
 * @body    {priority, serviceType}
 */
router.put(
  '/:counterId/token/next',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterValidation.callNextToken,
  counterController.callNextToken
);

/**
 * @route   PUT /api/counters/:counterId/token/recall
 * @desc    Recall current token
 * @access  Private (Admin, Sub Admin)
 */
router.put(
  '/:counterId/token/recall',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterController.recallToken
);

/**
 * @route   GET /api/counters/:counterId/current-token
 * @desc    Get currently serving token
 * @access  Private (All authenticated users)
 */
router.get(
  '/:counterId/current-token',
  counterController.getCurrentToken
);

/**
 * @route   POST /api/counters/:counterId/break/start
 * @desc    Start counter break
 * @access  Private (Admin, Sub Admin)
 * @body    {breakType, estimatedDuration, reason}
 */
router.post(
  '/:counterId/break/start',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterValidation.startCounterBreak,
  counterController.startCounterBreak
);

/**
 * @route   PUT /api/counters/:counterId/break/end
 * @desc    End counter break
 * @access  Private (Admin, Sub Admin)
 */
router.put(
  '/:counterId/break/end',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterController.endCounterBreak
);

/**
 * @route   GET /api/counters/:counterId/performance
 * @desc    Get counter performance metrics
 * @access  Private (Admin, Sub Admin)
 * @query   {startDate, endDate, metric}
 */
router.get(
  '/:counterId/performance',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterController.getCounterPerformance
);

/**
 * @route   GET /api/counters/:counterId/analytics
 * @desc    Get counter analytics
 * @access  Private (Admin, Sub Admin)
 * @query   {period, metrics}
 */
router.get(
  '/:counterId/analytics',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterController.getCounterAnalytics
);

/**
 * @route   PUT /api/counters/:counterId/hardware/config
 * @desc    Update hardware configuration
 * @access  Private (Super Admin, Admin)
 * @body    {displayConfig, printerConfig, audioConfig, ledConfig}
 */
router.put(
  '/:counterId/hardware/config',
  authorize(['super_admin', 'admin']),
  counterValidation.updateHardwareConfig,
  counterController.updateHardwareConfig
);

/**
 * @route   POST /api/counters/:counterId/hardware/test
 * @desc    Test hardware components
 * @access  Private (Admin, Sub Admin)
 * @body    {components}
 */
router.post(
  '/:counterId/hardware/test',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterValidation.testHardware,
  counterController.testHardware
);

/**
 * @route   GET /api/counters/department/:departmentId
 * @desc    Get all counters in a department
 * @access  Private (All authenticated users)
 */
router.get(
  '/department/:departmentId',
  counterController.getCountersByDepartment
);

/**
 * @route   GET /api/counters/status/overview
 * @desc    Get overview of all counter statuses
 * @access  Private (Admin, Sub Admin)
 */
router.get(
  '/status/overview',
  authorize(['super_admin', 'admin', 'sub_admin']),
  counterController.getCountersStatusOverview
);

/**
 * @route   POST /api/counters/bulk/update
 * @desc    Bulk update multiple counters
 * @access  Private (Super Admin only)
 * @body    {counterIds, updateData}
 */
router.post(
  '/bulk/update',
  authorize(['super_admin']),
  counterValidation.bulkUpdateCounters,
  counterController.bulkUpdateCounters
);

module.exports = router;

const express = require('express');
const departmentController = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');
const { departmentValidation } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all department routes
router.use(protect);

/**
 * @route   POST /api/departments
 * @desc    Create a new department
 * @access  Private (Super Admin, Admin only)
 * @body    {name, description, operatingHours, serviceTypes, maxTokensPerDay, queueSettings}
 */
router.post(
  '/',
  authorize(['super_admin', 'admin']),
  departmentValidation.createDepartment,
  departmentController.createDepartment
);

/**
 * @route   GET /api/departments
 * @desc    Get all departments with filtering and pagination
 * @access  Private (All authenticated users)
 * @query   {page, limit, status, search, sortBy}
 */
router.get(
  '/',
  departmentController.getDepartments
);

/**
 * @route   GET /api/departments/:departmentId
 * @desc    Get department by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:departmentId',
  departmentValidation.getDepartmentById,
  departmentController.getDepartment
);

/**
 * @route   PUT /api/departments/:departmentId
 * @desc    Update department
 * @access  Private (Super Admin, Admin only)
 * @body    {name, description, operatingHours, serviceTypes, maxTokensPerDay, queueSettings}
 */
router.put(
  '/:departmentId',
  authorize(['super_admin', 'admin']),
  departmentValidation.updateDepartment,
  departmentController.updateDepartment
);

/**
 * @route   DELETE /api/departments/:departmentId
 * @desc    Delete (soft delete) department
 * @access  Private (Super Admin only)
 */
router.delete(
  '/:departmentId',
  authorize(['super_admin']),
  departmentValidation.deleteDepartment,
  departmentController.deleteDepartment
);

/**
 * @route   PUT /api/departments/:departmentId/status
 * @desc    Update department status (active/inactive)
 * @access  Private (Super Admin, Admin)
 * @body    {status}
 */
router.put(
  '/:departmentId/status',
  authorize(['super_admin', 'admin']),
  departmentValidation.updateDepartmentStatus,
  departmentController.updateDepartmentStatus
);

/**
 * @route   GET /api/departments/:departmentId/counters
 * @desc    Get all counters in a department
 * @access  Private (All authenticated users)
 */
router.get(
  '/:departmentId/counters',
  departmentController.getDepartmentCounters
);

/**
 * @route   GET /api/departments/:departmentId/staff
 * @desc    Get staff assigned to a department
 * @access  Private (All authenticated users)
 */
router.get(
  '/:departmentId/staff',
  departmentController.getDepartmentStaff
);

/**
 * @route   POST /api/departments/:departmentId/staff
 * @desc    Assign staff to department
 * @access  Private (Super Admin, Admin)
 * @body    {staffIds, roles}
 */
router.post(
  '/:departmentId/staff',
  authorize(['super_admin', 'admin']),
  departmentValidation.assignStaffToDepartment,
  departmentController.assignStaffToDepartment
);

/**
 * @route   DELETE /api/departments/:departmentId/staff/:staffId
 * @desc    Remove staff from department
 * @access  Private (Super Admin, Admin)
 */
router.delete(
  '/:departmentId/staff/:staffId',
  authorize(['super_admin', 'admin']),
  departmentController.removeStaffFromDepartment
);

/**
 * @route   GET /api/departments/:departmentId/queue/status
 * @desc    Get current queue status for department
 * @access  Private (All authenticated users)
 */
router.get(
  '/:departmentId/queue/status',
  departmentController.getDepartmentQueueStatus
);

/**
 * @route   PUT /api/departments/:departmentId/queue/settings
 * @desc    Update queue settings for department
 * @access  Private (Super Admin, Admin)
 * @body    {maxWaitTime, priorityEnabled, allowBooking, tokenValidityMinutes}
 */
router.put(
  '/:departmentId/queue/settings',
  authorize(['super_admin', 'admin']),
  departmentValidation.updateQueueSettings,
  departmentController.updateQueueSettings
);

/**
 * @route   GET /api/departments/:departmentId/analytics
 * @desc    Get department analytics
 * @access  Private (Admin, Sub Admin)
 * @query   {startDate, endDate, metrics}
 */
router.get(
  '/:departmentId/analytics',
  authorize(['super_admin', 'admin', 'sub_admin']),
  departmentController.getDepartmentAnalytics
);

/**
 * @route   GET /api/departments/:departmentId/performance
 * @desc    Get department performance metrics
 * @access  Private (Admin, Sub Admin)
 * @query   {period, comparison}
 */
router.get(
  '/:departmentId/performance',
  authorize(['super_admin', 'admin', 'sub_admin']),
  departmentController.getDepartmentPerformance
);

/**
 * @route   PUT /api/departments/:departmentId/display/settings
 * @desc    Update display settings for department
 * @access  Private (Super Admin, Admin)
 * @body    {displayName, theme, announcements, tickerText}
 */
router.put(
  '/:departmentId/display/settings',
  authorize(['super_admin', 'admin']),
  departmentValidation.updateDisplaySettings,
  departmentController.updateDisplaySettings
);

/**
 * @route   GET /api/departments/operating/hours
 * @desc    Get operating hours for all departments
 * @access  Public
 */
router.get(
  '/operating/hours',
  departmentController.getAllDepartmentOperatingHours
);

/**
 * @route   POST /api/departments/bulk/update
 * @desc    Bulk update multiple departments
 * @access  Private (Super Admin only)
 * @body    {departments, updateFields}
 */
router.post(
  '/bulk/update',
  authorize(['super_admin']),
  departmentValidation.bulkUpdateDepartments,
  departmentController.bulkUpdateDepartments
);

module.exports = router;

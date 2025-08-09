const express = require('express');
const router = express.Router();

// Import middleware
const { protect: auth } = require('../middleware/auth');
// const { validateCustomer, validateTokenGeneration } = require('../middleware/validation');

// Simple validation middleware for now
const validateCustomer = (req, res, next) => {
  if (!req.body.firstName || !req.body.lastName || !req.body.phone) {
    return res.status(400).json({
      success: false,
      message: 'First name, last name, and phone are required'
    });
  }
  next();
};

const validateTokenGeneration = (req, res, next) => {
  if (!req.body.departmentId) {
    return res.status(400).json({
      success: false,
      message: 'Department ID is required'
    });
  }
  next();
};

// Import controller
const customerController = require('../controllers/customerController');

// Apply authentication middleware to all routes
router.use(auth);

/**
 * @route   GET /api/v1/customers
 * @desc    Get all customers with filtering and pagination
 * @access  Private (Admin, Sub-Admin)
 */
router.get('/', customerController.getCustomers);

/**
 * @route   GET /api/v1/customers/search
 * @desc    Search customers
 * @access  Private (Admin, Sub-Admin)
 */
router.get('/search', customerController.searchCustomers);

/**
 * @route   GET /api/v1/customers/:id
 * @desc    Get customer by ID
 * @access  Private (Admin, Sub-Admin - own customers only)
 */
router.get('/:id', customerController.getCustomer);

/**
 * @route   POST /api/v1/customers
 * @desc    Create new customer
 * @access  Private (Admin, Sub-Admin)
 */
router.post('/', validateCustomer, customerController.createCustomer);

/**
 * @route   PUT /api/v1/customers/:id
 * @desc    Update customer
 * @access  Private (Admin, Sub-Admin - own customers only)
 */
router.put('/:id', validateCustomer, customerController.updateCustomer);

/**
 * @route   DELETE /api/v1/customers/:id
 * @desc    Delete customer (soft delete)
 * @access  Private (Admin, Super-Admin)
 */
router.delete('/:id', customerController.deleteCustomer);

/**
 * @route   POST /api/v1/customers/:id/tokens
 * @desc    Generate token for customer
 * @access  Private (Admin, Sub-Admin)
 */
router.post('/:id/tokens', validateTokenGeneration, customerController.generateToken);

/**
 * @route   GET /api/v1/customers/:id/tokens
 * @desc    Get customer's token history
 * @access  Private (Admin, Sub-Admin - own customers only)
 */
router.get('/:id/tokens', customerController.getTokenHistory);

/**
 * @route   GET /api/v1/customers/:id/stats
 * @desc    Get customer statistics
 * @access  Private (Admin, Sub-Admin - own customers only)
 */
router.get('/:id/stats', customerController.getCustomerStats);

module.exports = router;

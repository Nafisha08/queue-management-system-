const Customer = require('../models/Customer');
const Token = require('../models/Token');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const logger = require('../utils/logger');

// Get all customers with filtering and pagination
exports.getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      customerType,
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { archived: false };
    
    // Add search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add filters
    if (customerType) query.customerType = customerType;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    // Role-based filtering
    if (req.user.role === 'sub_admin') {
      query.createdBy = req.user._id;
    }

    // Execute query with pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'subscription.planId', select: 'name code' }
      ]
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const customers = await Customer.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('subscription.planId', 'name code')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Customer.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
    });
  }
};

// Get customer by ID
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('subscription.planId');

    if (!customer || customer.archived) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'sub_admin' && customer.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    logger.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: error.message
    });
  }
};

// Create new customer
exports.createCustomer = async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Check if customer with phone already exists
    const existingCustomer = await Customer.findByPhone(customerData.phone);
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this phone number already exists'
      });
    }

    const customer = new Customer(customerData);
    await customer.save();

    await customer.populate('createdBy', 'firstName lastName');

    logger.info(`Customer created: ${customer.fullName} by ${req.user.fullName}`);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });

  } catch (error) {
    logger.error('Error creating customer:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating customer',
      error: error.message
    });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer || customer.archived) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'sub_admin' && customer.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check phone uniqueness if phone is being updated
    if (req.body.phone && req.body.phone !== customer.phone) {
      const existingCustomer = await Customer.findByPhone(req.body.phone);
      if (existingCustomer && existingCustomer._id.toString() !== customer._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'createdBy') {
        customer[key] = req.body[key];
      }
    });

    customer.lastModifiedBy = req.user._id;
    await customer.save();

    await customer.populate('createdBy lastModifiedBy', 'firstName lastName');

    logger.info(`Customer updated: ${customer.fullName} by ${req.user.fullName}`);

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    });

  } catch (error) {
    logger.error('Error updating customer:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating customer',
      error: error.message
    });
  }
};

// Delete customer (soft delete)
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer || customer.archived) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Only admin and super_admin can delete customers
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    customer.archived = true;
    customer.lastModifiedBy = req.user._id;
    await customer.save();

    logger.info(`Customer deleted: ${customer.fullName} by ${req.user.fullName}`);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting customer',
      error: error.message
    });
  }
};

// Generate token for customer
exports.generateToken = async (req, res) => {
  try {
    const { departmentId, priority } = req.body;
    const customerId = req.params.id;

    const customer = await Customer.findById(customerId);
    if (!customer || customer.archived) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const department = await Department.findById(departmentId);
    if (!department || department.archived) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if department is open
    if (!department.isOpen) {
      return res.status(400).json({
        success: false,
        message: 'Department is currently closed'
      });
    }

    // Find available counter in department
    const availableCounters = await Counter.findAvailable(departmentId);
    if (availableCounters.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No available counters in this department'
      });
    }

    // Check if customer already has an active token
    const activeToken = await Token.findOne({
      customer: customerId,
      status: { $in: ['waiting', 'called', 'in_service'] },
      businessDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    if (activeToken) {
      return res.status(400).json({
        success: false,
        message: 'Customer already has an active token',
        data: activeToken
      });
    }

    // Generate token
    const token = await Token.generateToken(
      departmentId,
      availableCounters[0]._id,
      customerId,
      priority || customer.priority,
      req.user._id
    );

    await token.populate([
      { path: 'customer', select: 'firstName lastName phone' },
      { path: 'department', select: 'name code' },
      { path: 'counter', select: 'name number' }
    ]);

    // Update customer token history
    customer.tokenHistory.push({
      tokenNumber: token.tokenNumber,
      department: departmentId,
      counter: availableCounters[0]._id,
      status: 'waiting'
    });
    await customer.save();

    logger.info(`Token generated: ${token.tokenNumber} for ${customer.fullName}`);

    res.status(201).json({
      success: true,
      message: 'Token generated successfully',
      data: token
    });

  } catch (error) {
    logger.error('Error generating token:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating token',
      error: error.message
    });
  }
};

// Get customer's token history
exports.getTokenHistory = async (req, res) => {
  try {
    const customerId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    const customer = await Customer.findById(customerId);
    if (!customer || customer.archived) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'sub_admin' && customer.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const tokens = await Token.find({ customer: customerId })
      .populate('department', 'name code')
      .populate('counter', 'name number')
      .populate('servedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Token.countDocuments({ customer: customerId });

    res.json({
      success: true,
      data: {
        tokens,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching token history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching token history',
      error: error.message
    });
  }
};

// Get customer statistics
exports.getCustomerStats = async (req, res) => {
  try {
    const customerId = req.params.id;

    const customer = await Customer.findById(customerId);
    if (!customer || customer.archived) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Update customer stats
    await customer.updateStats();

    // Get additional statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTokens = await Token.countDocuments({
      customer: customerId,
      businessDate: { $gte: today }
    });

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyTokens = await Token.countDocuments({
      customer: customerId,
      businessDate: { $gte: thisMonth }
    });

    res.json({
      success: true,
      data: {
        customer: {
          _id: customer._id,
          fullName: customer.fullName,
          stats: customer.stats
        },
        todayTokens,
        monthlyTokens
      }
    });

  } catch (error) {
    logger.error('Error fetching customer statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer statistics',
      error: error.message
    });
  }
};

// Search customers
exports.searchCustomers = async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    let query = { archived: false };

    // Role-based filtering
    if (req.user.role === 'sub_admin') {
      query.createdBy = req.user._id;
    }

    // Build search query based on type
    switch (type) {
      case 'phone':
        query.phone = { $regex: q, $options: 'i' };
        break;
      case 'email':
        query.email = { $regex: q, $options: 'i' };
        break;
      case 'name':
        query.$or = [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } }
        ];
        break;
      default:
        query.$or = [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } }
        ];
    }

    const customers = await Customer.find(query)
      .select('firstName lastName email phone customerType priority')
      .limit(20)
      .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      data: customers
    });

  } catch (error) {
    logger.error('Error searching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching customers',
      error: error.message
    });
  }
};

module.exports = exports;

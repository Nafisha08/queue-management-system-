const Joi = require('joi');

// Custom validation function
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
    next();
  };
};

// Project validation schema
const projectSchema = Joi.object({
  name: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().max(2000).allow(''),
  category: Joi.string().valid(
    'development', 'research', 'maintenance', 'testing', 
    'deployment', 'documentation', 'security', 'infrastructure', 
    'analytics', 'other'
  ),
  tags: Joi.array().items(Joi.string().trim().max(50)),
  priority: Joi.number().integer().min(1).max(10),
  estimatedDuration: Joi.object({
    hours: Joi.number().min(0),
    days: Joi.number().min(0),
    weeks: Joi.number().min(0)
  }),
  deadline: Joi.date().iso().greater('now'),
  assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  resources: Joi.object({
    cpu: Joi.number().min(0),
    memory: Joi.number().min(0),
    storage: Joi.number().min(0),
    custom: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      value: Joi.number().required(),
      unit: Joi.string()
    }))
  }),
  dependencies: Joi.array().items(Joi.object({
    project: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    type: Joi.string().valid('blocking', 'related', 'child', 'parent')
  })),
  metadata: Joi.object()
});

// Queue validation schema
const queueSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  description: Joi.string().trim().max(500).allow(''),
  type: Joi.string().valid('fifo', 'lifo', 'priority', 'weighted', 'round_robin', 'custom'),
  capacity: Joi.number().integer().min(1).max(10000),
  concurrency: Joi.number().integer().min(1).max(100),
  processingRules: Joi.object({
    autoAssign: Joi.boolean(),
    autoStart: Joi.boolean(),
    allowDuplicates: Joi.boolean(),
    requireApproval: Joi.boolean()
  }),
  policies: Joi.object({
    maxRetries: Joi.number().integer().min(0),
    timeout: Joi.number().integer().min(0),
    priorityWeights: Joi.object({
      high: Joi.number().min(0),
      medium: Joi.number().min(0),
      low: Joi.number().min(0)
    })
  }),
  resourceLimits: Joi.object({
    maxCpuPerProject: Joi.number().min(0),
    maxMemoryPerProject: Joi.number().min(0),
    maxStoragePerProject: Joi.number().min(0),
    totalCpuLimit: Joi.number().min(0),
    totalMemoryLimit: Joi.number().min(0)
  }),
  acceptanceCriteria: Joi.object({
    categories: Joi.array().items(Joi.string()),
    minPriority: Joi.number().integer().min(1).max(10),
    maxPriority: Joi.number().integer().min(1).max(10),
    tags: Joi.array().items(Joi.string()),
    customRules: Joi.array().items(Joi.object({
      field: Joi.string().required(),
      operator: Joi.string().valid('eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex').required(),
      value: Joi.any().required()
    }))
  }),
  permissions: Joi.object({
    owners: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
    managers: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
    workers: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
    viewers: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
  }),
  schedule: Joi.object({
    enabled: Joi.boolean(),
    pattern: Joi.string().when('enabled', {
      is: true,
      then: Joi.required()
    }),
    timezone: Joi.string()
  }),
  notifications: Joi.object({
    onProjectAdded: Joi.boolean(),
    onProjectCompleted: Joi.boolean(),
    onProjectFailed: Joi.boolean(),
    onQueueEmpty: Joi.boolean(),
    onQueueFull: Joi.boolean(),
    webhookUrl: Joi.string().uri().allow(''),
    emailNotifications: Joi.array().items(Joi.string().email())
  }),
  metadata: Joi.object()
});

// User registration schema
const userRegistrationSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).pattern(/^[a-zA-Z0-9_-]+$/).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().trim().max(50).required(),
  lastName: Joi.string().trim().max(50).required(),
  role: Joi.string().valid('admin', 'manager', 'worker', 'viewer'),
  profile: Joi.object({
    department: Joi.string().trim(),
    title: Joi.string().trim(),
    location: Joi.string().trim(),
    timezone: Joi.string(),
    phone: Joi.string().trim(),
    skills: Joi.array().items(Joi.string()),
    languages: Joi.array().items(Joi.string())
  })
});

// User login schema
const userLoginSchema = Joi.object({
  identifier: Joi.string().required(), // Can be username or email
  password: Joi.string().required()
});

// Progress update schema
const progressSchema = Joi.object({
  percentage: Joi.number().min(0).max(100).required()
});

// Milestone schema
const milestoneSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).allow('')
});

// User preferences schema
const userPreferencesSchema = Joi.object({
  workingHours: Joi.object({
    start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    timezone: Joi.string()
  }),
  workingDays: Joi.array().items(
    Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ),
  autoAssign: Joi.boolean(),
  preferredCategories: Joi.array().items(Joi.string()),
  maxPriorityLevel: Joi.number().integer().min(1).max(10),
  notifications: Joi.object({
    email: Joi.object({
      projectAssigned: Joi.boolean(),
      projectDue: Joi.boolean(),
      projectCompleted: Joi.boolean(),
      weeklyDigest: Joi.boolean()
    }),
    inApp: Joi.object({
      projectAssigned: Joi.boolean(),
      projectDue: Joi.boolean(),
      mentions: Joi.boolean()
    })
  })
});

// Password change schema
const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

// API key creation schema
const apiKeySchema = Joi.object({
  name: Joi.string().trim().min(3).max(50).required(),
  permissions: Joi.array().items(Joi.string()),
  expiresIn: Joi.string().valid('1h', '24h', '7d', '30d', '90d', '1y', 'never')
});

// Customer validation schema
const customerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required(),
  
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zipCode: Joi.string().optional(),
    country: Joi.string().default('US')
  }).optional(),
  
  customerType: Joi.string().valid('individual', 'business', 'vip', 'premium').default('individual'),
  priority: Joi.number().min(1).max(10).default(5),
  preferredServices: Joi.array().items(Joi.string()).optional(),
  
  subscription: Joi.object({
    planId: Joi.string().optional(),
    status: Joi.string().valid('active', 'expired', 'suspended', 'cancelled').default('active')
  }).optional(),
  
  notifications: Joi.object({
    sms: Joi.object({
      enabled: Joi.boolean().default(true),
      tokenReady: Joi.boolean().default(true),
      appointmentReminder: Joi.boolean().default(true)
    }).optional(),
    email: Joi.object({
      enabled: Joi.boolean().default(false),
      receipts: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }).optional()
  }).optional(),
  
  notes: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// Token generation schema
const tokenGenerationSchema = Joi.object({
  departmentId: Joi.string().required(),
  priority: Joi.number().min(1).max(10).optional(),
  serviceType: Joi.string().optional()
});

// Department validation schema
const departmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().min(2).max(10).pattern(/^[A-Z0-9]+$/).required(),
  description: Joi.string().max(500).optional(),
  
  serviceTypes: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      code: Joi.string().required(),
      estimatedServiceTime: Joi.number().min(1).default(15),
      priority: Joi.number().min(1).max(10).default(5)
    })
  ).optional(),
  
  operatingHours: Joi.object({
    monday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional(),
    tuesday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional(),
    wednesday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional(),
    thursday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional(),
    friday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional(),
    saturday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional(),
    sunday: Joi.object({ start: Joi.string(), end: Joi.string(), closed: Joi.boolean() }).optional()
  }).optional(),
  
  queueSettings: Joi.object({
    maxQueueSize: Joi.number().min(1).default(100),
    avgServiceTime: Joi.number().min(1).default(15),
    maxWaitTime: Joi.number().min(1).default(120),
    priorityEnabled: Joi.boolean().default(true),
    transferEnabled: Joi.boolean().default(true)
  }).optional(),
  
  location: Joi.object({
    floor: Joi.string().optional(),
    building: Joi.string().optional(),
    room: Joi.string().optional(),
    address: Joi.string().optional()
  }).optional(),
  
  contactInfo: Joi.object({
    phone: Joi.string().optional(),
    email: Joi.string().email().optional(),
    extension: Joi.string().optional()
  }).optional()
});

// Counter validation schema
const counterSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  number: Joi.string().trim().min(1).max(10).required(),
  code: Joi.string().trim().min(2).max(10).pattern(/^[A-Z0-9]+$/).required(),
  department: Joi.string().required(),
  
  counterType: Joi.string().valid('service', 'consultation', 'payment', 'information', 'priority', 'general').default('general'),
  serviceTypes: Joi.array().items(Joi.string()).optional(),
  
  settings: Joi.object({
    maxConcurrentTokens: Joi.number().min(1).default(1),
    avgServiceTime: Joi.number().min(1).default(15),
    breakDuration: Joi.number().min(1).default(15),
    autoCallNext: Joi.boolean().default(true),
    playAnnouncement: Joi.boolean().default(true)
  }).optional(),
  
  workingHours: Joi.object({
    monday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional(),
    tuesday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional(),
    wednesday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional(),
    thursday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional(),
    friday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional(),
    saturday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional(),
    sunday: Joi.object({ start: Joi.string(), end: Joi.string(), active: Joi.boolean() }).optional()
  }).optional(),
  
  location: Joi.object({
    floor: Joi.string().optional(),
    section: Joi.string().optional(),
    coordinates: Joi.object({
      x: Joi.number().optional(),
      y: Joi.number().optional()
    }).optional()
  }).optional()
});

// Payment validation schemas
const createPaymentSchema = Joi.object({
  customerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  tokenId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  amount: Joi.number().min(0.01).required(),
  currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').default('INR'),
  paymentMethod: Joi.string().valid('cash', 'upi', 'card', 'net_banking', 'wallet', 'bank_transfer').default('cash'),
  description: Joi.string().max(500).optional(),
  serviceType: Joi.string().default('token_service'),
  departmentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  counterId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  
  paymentDetails: Joi.object({
    upi: Joi.object({
      upiId: Joi.string().optional(),
      vpa: Joi.string().optional(),
      pspName: Joi.string().optional()
    }).optional(),
    cash: Joi.object({
      denomination: Joi.array().items(Joi.object({
        note: Joi.number().valid(1, 2, 5, 10, 20, 50, 100, 200, 500, 2000).required(),
        count: Joi.number().min(0).required()
      })).optional(),
      changeGiven: Joi.number().min(0).default(0)
    }).optional()
  }).optional(),
  
  charges: Joi.array().items(Joi.object({
    chargeType: Joi.string().valid('service_charge', 'convenience_fee', 'processing_fee', 'tax', 'discount').required(),
    amount: Joi.number().min(0).required(),
    description: Joi.string().max(200).optional()
  })).optional(),
  
  invoice: Joi.object({
    taxPercentage: Joi.number().min(0).max(100).default(0),
    discountAmount: Joi.number().min(0).default(0)
  }).optional()
});

const processUpiPaymentSchema = Joi.object({
  upiId: Joi.string().required(),
  transactionId: Joi.string().required(),
  vpa: Joi.string().optional(),
  pspName: Joi.string().optional(),
  merchantTransactionId: Joi.string().optional(),
  gatewayResponse: Joi.object().optional()
});

const processCashPaymentSchema = Joi.object({
  denomination: Joi.array().items(Joi.object({
    note: Joi.number().valid(1, 2, 5, 10, 20, 50, 100, 200, 500, 2000).required(),
    count: Joi.number().min(0).required()
  })).optional(),
  receivedAmount: Joi.number().min(0).optional(),
  changeGiven: Joi.number().min(0).default(0)
});

const refundPaymentSchema = Joi.object({
  amount: Joi.number().min(0.01).required(),
  reason: Joi.string().min(5).max(500).required()
});

const paymentIdSchema = Joi.object({
  paymentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});

const customerPaymentsSchema = Joi.object({
  customerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});

const createTokenPaymentSchema = Joi.object({
  amount: Joi.number().min(0.01).required(),
  paymentMethod: Joi.string().valid('cash', 'upi', 'card', 'net_banking', 'wallet', 'bank_transfer').default('cash'),
  paymentDetails: Joi.object().optional(),
  charges: Joi.array().items(Joi.object({
    chargeType: Joi.string().valid('service_charge', 'convenience_fee', 'processing_fee', 'tax', 'discount').required(),
    amount: Joi.number().min(0).required(),
    description: Joi.string().max(200).optional()
  })).optional()
});

const tokenPaymentStatusSchema = Joi.object({
  tokenId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});

const quickCashPaymentSchema = Joi.object({
  customerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  tokenId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  amount: Joi.number().min(0.01).required(),
  receivedAmount: Joi.number().min(0.01).required(),
  description: Joi.string().max(500).optional()
});

const quickUpiPaymentSchema = Joi.object({
  customerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  tokenId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  amount: Joi.number().min(0.01).required(),
  upiId: Joi.string().required(),
  description: Joi.string().max(500).optional()
});

const bulkProcessPaymentsSchema = Joi.object({
  payments: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).min(1).required(),
  action: Joi.string().valid('complete', 'cancel').required()
});

// Export validation middleware
module.exports = {
  validateProject: validate(projectSchema),
  validateQueue: validate(queueSchema),
  validateUserRegistration: validate(userRegistrationSchema),
  validateUserLogin: validate(userLoginSchema),
  validateProgress: validate(progressSchema),
  validateMilestone: validate(milestoneSchema),
  validateUserPreferences: validate(userPreferencesSchema),
  validatePasswordChange: validate(passwordChangeSchema),
  validateApiKey: validate(apiKeySchema),
  validateCustomer: validate(customerSchema),
  validateTokenGeneration: validate(tokenGenerationSchema),
  validateDepartment: validate(departmentSchema),
  validateCounter: validate(counterSchema),
  
  // Payment validations
  paymentValidation: {
    createPayment: validate(createPaymentSchema),
    processUpiPayment: validate(processUpiPaymentSchema),
    processCashPayment: validate(processCashPaymentSchema),
    refundPayment: validate(refundPaymentSchema),
    getPaymentById: validate(paymentIdSchema),
    getCustomerPayments: validate(customerPaymentsSchema),
    createTokenPayment: validate(createTokenPaymentSchema),
    getTokenPaymentStatus: validate(tokenPaymentStatusSchema),
    quickCashPayment: validate(quickCashPaymentSchema),
    quickUpiPayment: validate(quickUpiPaymentSchema),
    bulkProcessPayments: validate(bulkProcessPaymentsSchema)
  },
  
  // Token validations
  tokenValidation: {
    generateToken: validate(tokenGenerationSchema),
    getTokenById: (req, res, next) => { next(); }, // Placeholder
    callToken: (req, res, next) => { next(); }, // Placeholder
    serveToken: (req, res, next) => { next(); }, // Placeholder
    completeToken: (req, res, next) => { next(); }, // Placeholder
    cancelToken: (req, res, next) => { next(); }, // Placeholder
    transferToken: (req, res, next) => { next(); }, // Placeholder
    getCustomerTokens: (req, res, next) => { next(); }, // Placeholder
    updateTokenPriority: (req, res, next) => { next(); } // Placeholder
  },
  
  // Department validations
  departmentValidation: {
    createDepartment: validate(departmentSchema),
    getDepartmentById: (req, res, next) => { next(); }, // Placeholder
    updateDepartment: validate(departmentSchema),
    deleteDepartment: (req, res, next) => { next(); }, // Placeholder
    updateDepartmentStatus: (req, res, next) => { next(); }, // Placeholder
    assignStaffToDepartment: (req, res, next) => { next(); }, // Placeholder
    updateQueueSettings: (req, res, next) => { next(); }, // Placeholder
    updateDisplaySettings: (req, res, next) => { next(); }, // Placeholder
    bulkUpdateDepartments: (req, res, next) => { next(); } // Placeholder
  },
  
  // Counter validations
  counterValidation: {
    createCounter: validate(counterSchema),
    getCounterById: (req, res, next) => { next(); }, // Placeholder
    updateCounter: validate(counterSchema),
    deleteCounter: (req, res, next) => { next(); }, // Placeholder
    updateCounterStatus: (req, res, next) => { next(); }, // Placeholder
    assignStaffToCounter: (req, res, next) => { next(); }, // Placeholder
    callNextToken: (req, res, next) => { next(); }, // Placeholder
    startCounterBreak: (req, res, next) => { next(); }, // Placeholder
    updateHardwareConfig: (req, res, next) => { next(); }, // Placeholder
    testHardware: (req, res, next) => { next(); }, // Placeholder
    bulkUpdateCounters: (req, res, next) => { next(); } // Placeholder
  }
};

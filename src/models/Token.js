const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  // Token Information
  tokenNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  displayNumber: {
    type: String,
    required: true
  },
  
  // Customer Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  
  // Service Information
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  
  serviceType: {
    type: String,
    required: true
  },
  
  // Counter Assignment
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  
  // Priority and Queue Position
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  queuePosition: {
    type: Number,
    min: 1
  },
  
  // Status and Timing
  status: {
    type: String,
    enum: ['waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show', 'transferred'],
    default: 'waiting'
  },
  
  // Timestamps
  issuedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  calledAt: Date,
  serviceStartedAt: Date,
  completedAt: Date,
  
  // Time Calculations
  waitTime: {
    type: Number, // in minutes
    default: 0
  },
  
  serviceTime: {
    type: Number, // in minutes
    default: 0
  },
  
  // Service Details
  serviceNotes: String,
  
  satisfactionRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  feedback: String,
  
  // Payment Information
  payment: {
    required: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    status: {
      type: String,
      enum: ['not_required', 'pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'not_required'
    },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'net_banking', 'wallet', 'bank_transfer']
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    paidAt: Date,
    
    // Quick Payment Details (for display purposes)
    transactionId: String,
    receiptNumber: String,
    
    // Service Charges breakdown
    charges: [{
      chargeType: {
        type: String,
        enum: ['service_fee', 'processing_fee', 'tax', 'discount', 'convenience_fee']
      },
      amount: Number,
      description: String
    }],
    
    // Total amount including all charges
    totalAmount: Number,
    
    // Payment due date (if applicable)
    dueDate: Date,
    
    // Payment notes
    paymentNotes: String
  },
  
  // Staff Information
  servedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Transfer Information
  transferHistory: [{
    fromDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    toDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    fromCounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter'
    },
    toCounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter'
    },
    reason: String,
    transferredAt: {
      type: Date,
      default: Date.now
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Notification Status
  notifications: {
    issued: {
      type: Boolean,
      default: false
    },
    nearTurn: {
      type: Boolean,
      default: false
    },
    called: {
      type: Boolean,
      default: false
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  
  // Additional Information
  estimatedWaitTime: {
    type: Number, // in minutes
    default: 0
  },
  
  estimatedServiceTime: {
    type: Number, // in minutes
    default: 15
  },
  
  // System Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Business Date (for reporting)
  businessDate: {
    type: Date,
    required: true,
    default: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
tokenSchema.index({ tokenNumber: 1 }, { unique: true });
tokenSchema.index({ department: 1, status: 1, createdAt: -1 });
tokenSchema.index({ counter: 1, status: 1 });
tokenSchema.index({ customer: 1, businessDate: -1 });
tokenSchema.index({ businessDate: -1, status: 1 });
tokenSchema.index({ queuePosition: 1, status: 1 });
tokenSchema.index({ priority: -1, issuedAt: 1 });

// Virtual properties
tokenSchema.virtual('isActive').get(function() {
  return ['waiting', 'called', 'in_service'].includes(this.status);
});

tokenSchema.virtual('totalTime').get(function() {
  if (this.completedAt && this.issuedAt) {
    return Math.round((this.completedAt - this.issuedAt) / (1000 * 60)); // in minutes
  }
  return 0;
});

tokenSchema.virtual('currentWaitTime').get(function() {
  if (this.status === 'waiting' && this.issuedAt) {
    return Math.round((Date.now() - this.issuedAt) / (1000 * 60)); // in minutes
  }
  return this.waitTime;
});

// Pre-save middleware
tokenSchema.pre('save', function(next) {
  // Calculate wait time when service starts
  if (this.isModified('serviceStartedAt') && this.serviceStartedAt && this.issuedAt) {
    this.waitTime = Math.round((this.serviceStartedAt - this.issuedAt) / (1000 * 60));
  }
  
  // Calculate service time when completed
  if (this.isModified('completedAt') && this.completedAt && this.serviceStartedAt) {
    this.serviceTime = Math.round((this.completedAt - this.serviceStartedAt) / (1000 * 60));
  }
  
  // Set business date if not provided
  if (!this.businessDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.businessDate = today;
  }
  
  next();
});

// Instance methods
tokenSchema.methods.callToken = function(counterId, userId) {
  this.status = 'called';
  this.calledAt = new Date();
  this.counter = counterId;
  this.lastModifiedBy = userId;
  
  // Trigger notification
  this.notifications.called = true;
  
  return this.save();
};

tokenSchema.methods.startService = function(userId) {
  this.status = 'in_service';
  this.serviceStartedAt = new Date();
  this.servedBy = userId;
  this.lastModifiedBy = userId;
  
  return this.save();
};

tokenSchema.methods.completeService = function(userId, notes, rating) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.serviceNotes = notes;
  this.satisfactionRating = rating;
  this.lastModifiedBy = userId;
  
  // Trigger notification
  this.notifications.completed = true;
  
  return this.save();
};

tokenSchema.methods.cancelToken = function(userId, reason) {
  this.status = 'cancelled';
  this.serviceNotes = reason;
  this.lastModifiedBy = userId;
  
  return this.save();
};

tokenSchema.methods.markNoShow = function(userId) {
  this.status = 'no_show';
  this.lastModifiedBy = userId;
  
  return this.save();
};

tokenSchema.methods.transferToken = function(newDepartment, newCounter, reason, userId) {
  const transferRecord = {
    fromDepartment: this.department,
    toDepartment: newDepartment,
    fromCounter: this.counter,
    toCounter: newCounter,
    reason,
    transferredBy: userId
  };
  
  this.transferHistory.push(transferRecord);
  this.department = newDepartment;
  this.counter = newCounter;
  this.status = 'transferred';
  this.lastModifiedBy = userId;
  
  return this.save();
};

// Static methods
tokenSchema.statics.generateTokenNumber = async function(department, date = new Date()) {
  const Department = require('./Department');
  const dept = await Department.findById(department);
  
  if (!dept) {
    throw new Error('Department not found');
  }
  
  // Format: DEPT-YYYYMMDD-NNN (e.g., CS-20241201-001)
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = dept.code + '-' + dateStr + '-';
  
  // Find the last token for this department and date
  const lastToken = await this.findOne({
    tokenNumber: { $regex: `^${prefix}` },
    businessDate: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    }
  }).sort({ tokenNumber: -1 });
  
  let nextNumber = 1;
  if (lastToken) {
    const lastNumber = parseInt(lastToken.tokenNumber.split('-').pop());
    nextNumber = lastNumber + 1;
  }
  
  const tokenNumber = prefix + String(nextNumber).padStart(3, '0');
  const displayNumber = dept.code + String(nextNumber).padStart(3, '0');
  
  return { tokenNumber, displayNumber };
};

tokenSchema.statics.generateToken = async function(departmentId, counterId, customerId, priority = 5, userId) {
  const { tokenNumber, displayNumber } = await this.generateTokenNumber(departmentId);
  
  // Calculate queue position
  const queueCount = await this.countDocuments({
    department: departmentId,
    status: { $in: ['waiting', 'called'] },
    businessDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  });
  
  const token = new this({
    tokenNumber,
    displayNumber,
    customer: customerId,
    department: departmentId,
    counter: counterId,
    priority,
    queuePosition: queueCount + 1,
    createdBy: userId,
    serviceType: 'general' // Default service type
  });
  
  return await token.save();
};

tokenSchema.statics.getQueueStatus = async function(departmentId, date = new Date()) {
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const stats = await this.aggregate([
    {
      $match: {
        department: mongoose.Types.ObjectId(departmentId),
        businessDate: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgWaitTime: { $avg: '$waitTime' },
        avgServiceTime: { $avg: '$serviceTime' }
      }
    }
  ]);
  
  const result = {
    waiting: 0,
    called: 0,
    in_service: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    total: 0,
    avgWaitTime: 0,
    avgServiceTime: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    
    if (stat._id === 'completed') {
      result.avgWaitTime = Math.round(stat.avgWaitTime || 0);
      result.avgServiceTime = Math.round(stat.avgServiceTime || 0);
    }
  });
  
  return result;
};

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;

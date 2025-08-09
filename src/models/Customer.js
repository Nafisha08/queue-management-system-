const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  // Address Information
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'US'
    }
  },
  
  // Customer Details
  customerType: {
    type: String,
    enum: ['individual', 'business', 'vip', 'premium'],
    default: 'individual'
  },
  
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  // Service Preferences
  preferredServices: [String],
  
  // Subscription and Plan Details
  subscription: {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'suspended', 'cancelled'],
      default: 'active'
    },
    startDate: Date,
    endDate: Date,
    renewalDate: Date
  },
  
  // Payment Information
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'failed'],
    default: 'paid'
  },
  
  totalAmountDue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastPaymentDate: Date,
  
  // Payment Methods and Preferences
  preferredPaymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'net_banking', 'wallet', 'bank_transfer'],
    default: 'cash'
  },
  
  paymentDetails: {
    // UPI Payment Details
    upi: {
      defaultUpiId: String,
      preferredPspName: String // PhonePe, Paytm, GPay, etc.
    },
    
    // Card Details
    cards: [{
      cardId: String,
      cardType: String, // 'credit', 'debit'
      last4Digits: String,
      bankName: String,
      isDefault: Boolean,
      expiryMonth: Number,
      expiryYear: Number
    }],
    
    // Net Banking
    netBanking: {
      preferredBank: String,
      accountMasked: String // Last 4 digits
    }
  },
  
  // Payment History Summary
  paymentSummary: {
    totalPaid: {
      type: Number,
      default: 0
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    averageTransactionAmount: {
      type: Number,
      default: 0
    },
    lastTransactionDate: Date,
    paymentMethodUsage: {
      cash: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
      netBanking: { type: Number, default: 0 },
      wallet: { type: Number, default: 0 },
      bankTransfer: { type: Number, default: 0 }
    }
  },
  
  // Token History
  tokenHistory: [{
    tokenNumber: {
      type: String,
      required: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    counter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter'
    },
    issueTime: {
      type: Date,
      default: Date.now
    },
    serviceTime: Date,
    completedTime: Date,
    status: {
      type: String,
      enum: ['waiting', 'in_service', 'completed', 'cancelled', 'no_show'],
      default: 'waiting'
    },
    waitTime: Number, // in minutes
    serviceTime: Number, // in minutes
    notes: String
  }],
  
  // Statistics
  stats: {
    totalVisits: {
      type: Number,
      default: 0
    },
    averageWaitTime: {
      type: Number,
      default: 0
    },
    averageServiceTime: {
      type: Number,
      default: 0
    },
    noShowCount: {
      type: Number,
      default: 0
    },
    lastVisitDate: Date,
    preferredTimeSlots: [String],
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    }
  },
  
  // Communication Preferences
  notifications: {
    sms: {
      enabled: {
        type: Boolean,
        default: true
      },
      tokenReady: {
        type: Boolean,
        default: true
      },
      appointmentReminder: {
        type: Boolean,
        default: true
      }
    },
    email: {
      enabled: {
        type: Boolean,
        default: false
      },
      receipts: {
        type: Boolean,
        default: true
      },
      promotions: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Additional Information
  notes: String,
  tags: [String],
  
  // System Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ createdBy: 1, status: 1 });
customerSchema.index({ 'subscription.status': 1 });
customerSchema.index({ customerType: 1, priority: -1 });
customerSchema.index({ archived: 1, createdAt: -1 });

// Virtual properties
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

customerSchema.virtual('currentToken').get(function() {
  return this.tokenHistory.find(token => ['waiting', 'in_service'].includes(token.status));
});

customerSchema.virtual('totalTokensIssued').get(function() {
  return this.tokenHistory.length;
});

// Instance methods
customerSchema.methods.issueToken = function(department, counter, priority = this.priority) {
  const Token = require('./Token');
  
  return Token.generateToken(department, counter, this._id, priority);
};

customerSchema.methods.updateStats = function() {
  const completedTokens = this.tokenHistory.filter(token => token.status === 'completed');
  
  if (completedTokens.length > 0) {
    const totalWaitTime = completedTokens.reduce((sum, token) => sum + (token.waitTime || 0), 0);
    const totalServiceTime = completedTokens.reduce((sum, token) => sum + (token.serviceTime || 0), 0);
    
    this.stats.averageWaitTime = totalWaitTime / completedTokens.length;
    this.stats.averageServiceTime = totalServiceTime / completedTokens.length;
    this.stats.totalVisits = completedTokens.length;
    this.stats.lastVisitDate = completedTokens[completedTokens.length - 1].completedTime;
  }
  
  this.stats.noShowCount = this.tokenHistory.filter(token => token.status === 'no_show').length;
  
  return this.save();
};

// Static methods
customerSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone, archived: false });
};

customerSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, archived: false });
};

customerSchema.statics.findVIPCustomers = function() {
  return this.find({
    $or: [
      { customerType: 'vip' },
      { customerType: 'premium' },
      { priority: { $gte: 8 } }
    ],
    status: 'active',
    archived: false
  });
};

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;

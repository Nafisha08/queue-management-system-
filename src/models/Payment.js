const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment Basic Information
  paymentId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Customer and Service Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  
  token: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token'
  },
  
  // Payment Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  
  // Payment Method
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'upi', 'card', 'net_banking', 'wallet', 'bank_transfer'],
    default: 'cash'
  },
  
  // Payment Method Specific Details
  paymentDetails: {
    // UPI Details
    upi: {
      upiId: String,
      transactionId: String,
      vpa: String, // Virtual Payment Address
      pspName: String, // Payment Service Provider (PhonePe, Paytm, GPay, etc.)
      merchantId: String,
      merchantTransactionId: String
    },
    
    // Cash Details
    cash: {
      receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      denomination: [{
        note: Number, // 500, 200, 100, 50, 20, 10
        count: Number
      }],
      changeGiven: {
        type: Number,
        default: 0
      }
    },
    
    // Card Details (for future use)
    card: {
      cardType: String, // 'credit', 'debit'
      last4Digits: String,
      bankName: String,
      cardNetwork: String // 'visa', 'mastercard', 'rupay'
    },
    
    // Net Banking
    netBanking: {
      bankName: String,
      transactionId: String
    },
    
    // Wallet
    wallet: {
      walletProvider: String, // 'paytm', 'mobikwik', 'freecharge'
      walletTransactionId: String
    }
  },
  
  // Payment Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Payment Flow Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  
  processedAt: Date,
  completedAt: Date,
  failedAt: Date,
  cancelledAt: Date,
  refundedAt: Date,
  
  // Transaction Details
  description: {
    type: String,
    maxlength: 500
  },
  
  serviceType: {
    type: String,
    default: 'token_service'
  },
  
  // Invoice Information
  invoice: {
    invoiceNumber: String,
    invoiceDate: Date,
    dueDate: Date,
    taxAmount: {
      type: Number,
      default: 0
    },
    taxPercentage: {
      type: Number,
      default: 0
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    finalAmount: Number
  },
  
  // Payment Gateway Information (for UPI/Online)
  gateway: {
    gatewayName: String, // 'razorpay', 'payu', 'ccavenue', 'phonepe'
    gatewayTransactionId: String,
    gatewayOrderId: String,
    gatewayResponse: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  
  // Refund Information
  refund: {
    refundAmount: {
      type: Number,
      default: 0
    },
    refundReason: String,
    refundDate: Date,
    refundTransactionId: String,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Additional Charges
  charges: [{
    chargeType: {
      type: String,
      enum: ['service_charge', 'convenience_fee', 'processing_fee', 'tax', 'discount']
    },
    amount: Number,
    description: String
  }],
  
  // Receipt Information
  receipt: {
    receiptNumber: String,
    receiptUrl: String,
    emailSent: {
      type: Boolean,
      default: false
    },
    smsSent: {
      type: Boolean,
      default: false
    },
    printed: {
      type: Boolean,
      default: false
    }
  },
  
  // System Fields
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  
  // Business Date
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
  },
  
  // Notes
  notes: String,
  
  // System Tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentSchema.index({ paymentId: 1 }, { unique: true });
paymentSchema.index({ customer: 1, businessDate: -1 });
paymentSchema.index({ status: 1, paymentMethod: 1 });
paymentSchema.index({ businessDate: -1, status: 1 });
paymentSchema.index({ 'gateway.gatewayTransactionId': 1 });
paymentSchema.index({ 'paymentDetails.upi.transactionId': 1 });

// Virtual properties
paymentSchema.virtual('totalAmount').get(function() {
  let total = this.amount;
  
  if (this.charges && this.charges.length > 0) {
    this.charges.forEach(charge => {
      if (charge.chargeType === 'discount') {
        total -= charge.amount;
      } else {
        total += charge.amount;
      }
    });
  }
  
  return Math.max(0, total);
});

paymentSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

paymentSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

paymentSchema.virtual('isFailed').get(function() {
  return ['failed', 'cancelled'].includes(this.status);
});

paymentSchema.virtual('paymentDuration').get(function() {
  if (this.completedAt && this.initiatedAt) {
    return Math.round((this.completedAt - this.initiatedAt) / 1000); // in seconds
  }
  return null;
});

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Generate payment ID if not exists
  if (!this.paymentId && this.isNew) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-6);
    this.paymentId = `PAY${dateStr}${timestamp}`;
  }
  
  // Set processed timestamp when status changes to processing
  if (this.isModified('status') && this.status === 'processing' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  // Set completed timestamp when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Set failed timestamp when status changes to failed
  if (this.isModified('status') && ['failed', 'cancelled'].includes(this.status)) {
    this.failedAt = new Date();
  }
  
  // Calculate final amount for invoice
  if (this.invoice && !this.invoice.finalAmount) {
    this.invoice.finalAmount = this.totalAmount;
  }
  
  next();
});

// Instance methods
paymentSchema.methods.processPayment = async function(userId) {
  this.status = 'processing';
  this.processedBy = userId;
  this.processedAt = new Date();
  
  return this.save();
};

paymentSchema.methods.completePayment = async function(transactionDetails = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Update payment details based on method
  if (this.paymentMethod === 'upi' && transactionDetails.upi) {
    Object.assign(this.paymentDetails.upi, transactionDetails.upi);
  } else if (this.paymentMethod === 'cash' && transactionDetails.cash) {
    Object.assign(this.paymentDetails.cash, transactionDetails.cash);
  }
  
  // Generate receipt number
  if (!this.receipt.receiptNumber) {
    this.receipt.receiptNumber = `RCP${Date.now()}`;
  }
  
  return this.save();
};

paymentSchema.methods.failPayment = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.notes = reason;
  
  return this.save();
};

paymentSchema.methods.refundPayment = async function(amount, reason, userId) {
  if (this.status !== 'completed') {
    throw new Error('Can only refund completed payments');
  }
  
  this.refund.refundAmount = amount;
  this.refund.refundReason = reason;
  this.refund.refundDate = new Date();
  this.refund.refundedBy = userId;
  this.status = 'refunded';
  
  return this.save();
};

paymentSchema.methods.generateInvoice = function() {
  if (!this.invoice.invoiceNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    this.invoice.invoiceNumber = `INV${dateStr}${Date.now().toString().slice(-4)}`;
    this.invoice.invoiceDate = new Date();
  }
  
  // Calculate tax and final amount
  if (this.invoice.taxPercentage > 0) {
    this.invoice.taxAmount = (this.amount * this.invoice.taxPercentage) / 100;
  }
  
  this.invoice.finalAmount = this.amount + (this.invoice.taxAmount || 0) - (this.invoice.discountAmount || 0);
  
  return this.save();
};

// Static methods
paymentSchema.statics.generatePaymentId = function() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timestamp = Date.now().toString().slice(-6);
  return `PAY${dateStr}${timestamp}`;
};

paymentSchema.statics.findByCustomer = function(customerId, status = null) {
  const query = { customer: customerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('customer', 'firstName lastName phone')
    .populate('token', 'tokenNumber displayNumber')
    .sort({ createdAt: -1 });
};

paymentSchema.statics.getDailyReport = async function(date = new Date()) {
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const report = await this.aggregate([
    {
      $match: {
        businessDate: { $gte: startOfDay, $lte: endOfDay }
      }
    },
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
  
  return report;
};

paymentSchema.statics.getPaymentAnalytics = async function(startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        businessDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$businessDate' } },
          method: '$paymentMethod'
        },
        count: { $sum: 1 },
        revenue: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $sort: { '_id.date': 1, '_id.method': 1 }
    }
  ]);
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

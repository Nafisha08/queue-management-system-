const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 20
  },
  
  description: {
    type: String,
    maxlength: 1000
  },
  
  // Plan Type
  planType: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'enterprise', 'custom'],
    default: 'basic'
  },
  
  // Pricing Information
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    billingCycle: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    setupFee: {
      type: Number,
      default: 0,
      min: 0
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  
  // Plan Limits and Features
  features: {
    // Token Management Features
    maxTokensPerDay: {
      type: Number,
      default: 100
    },
    maxTokensPerMonth: {
      type: Number,
      default: 3000
    },
    maxDepartments: {
      type: Number,
      default: 5
    },
    maxCounters: {
      type: Number,
      default: 10
    },
    maxUsers: {
      type: Number,
      default: 5
    },
    
    // Advanced Features
    prioritySupport: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    mobileApp: {
      type: Boolean,
      default: false
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    
    // Display and LED Features
    ledDisplaySupport: {
      type: Boolean,
      default: false
    },
    maxLedDisplays: {
      type: Number,
      default: 0
    },
    customDisplayThemes: {
      type: Boolean,
      default: false
    },
    audioAnnouncements: {
      type: Boolean,
      default: false
    },
    
    // Integration Features
    paymentGatewayIntegration: {
      type: Boolean,
      default: false
    },
    thirdPartyIntegrations: {
      type: Number, // max number of integrations
      default: 0
    },
    webhookSupport: {
      type: Boolean,
      default: false
    },
    
    // Reporting Features
    basicReports: {
      type: Boolean,
      default: true
    },
    advancedReports: {
      type: Boolean,
      default: false
    },
    customReports: {
      type: Boolean,
      default: false
    },
    dataExport: {
      type: Boolean,
      default: false
    },
    realTimeAnalytics: {
      type: Boolean,
      default: false
    },
    
    // Storage and Backup
    dataRetentionDays: {
      type: Number,
      default: 30
    },
    automaticBackup: {
      type: Boolean,
      default: false
    },
    cloudStorage: {
      type: Boolean,
      default: false
    }
  },
  
  // Trial Information
  trial: {
    available: {
      type: Boolean,
      default: false
    },
    durationDays: {
      type: Number,
      default: 14
    },
    requiresCreditCard: {
      type: Boolean,
      default: false
    }
  },
  
  // Plan Availability
  availability: {
    isActive: {
      type: Boolean,
      default: true
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    availableFrom: Date,
    availableUntil: Date,
    targetCustomerTypes: [{
      type: String,
      enum: ['individual', 'business', 'enterprise', 'government']
    }],
    targetRegions: [String]
  },
  
  // Upgrade/Downgrade Rules
  upgradeRules: {
    canUpgradeFrom: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    }],
    upgradeDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  
  downgradeRules: {
    canDowngradeTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    }],
    dataRetentionAfterDowngrade: {
      type: Number,
      default: 30
    }
  },
  
  // Terms and Conditions
  terms: {
    contractLength: {
      type: Number, // in months
      default: 1
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    cancellationPolicy: {
      type: String,
      maxlength: 1000
    },
    refundPolicy: {
      type: String,
      maxlength: 1000
    }
  },
  
  // Statistics
  stats: {
    totalSubscribers: {
      type: Number,
      default: 0
    },
    activeSubscribers: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageSubscriptionLength: {
      type: Number, // in days
      default: 0
    },
    churnRate: {
      type: Number, // percentage
      default: 0
    }
  },
  
  // Metadata
  metadata: {
    displayOrder: {
      type: Number,
      default: 0
    },
    popularPlan: {
      type: Boolean,
      default: false
    },
    recommendedFor: [String],
    tags: [String],
    color: {
      type: String,
      default: '#2196F3'
    }
  },
  
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
subscriptionPlanSchema.index({ code: 1 }, { unique: true });
subscriptionPlanSchema.index({ planType: 1, 'availability.isActive': 1 });
subscriptionPlanSchema.index({ 'pricing.basePrice': 1 });
subscriptionPlanSchema.index({ 'metadata.displayOrder': 1 });
subscriptionPlanSchema.index({ archived: 1, createdAt: -1 });

// Virtual properties
subscriptionPlanSchema.virtual('effectivePrice').get(function() {
  const basePrice = this.pricing.basePrice;
  const discount = this.pricing.discountPercentage;
  
  if (discount > 0) {
    return basePrice * (1 - discount / 100);
  }
  
  return basePrice;
});

subscriptionPlanSchema.virtual('monthlyPrice').get(function() {
  const price = this.effectivePrice;
  const cycle = this.pricing.billingCycle;
  
  switch (cycle) {
    case 'daily':
      return price * 30;
    case 'weekly':
      return price * 4.33; // average weeks per month
    case 'monthly':
      return price;
    case 'quarterly':
      return price / 3;
    case 'yearly':
      return price / 12;
    default:
      return price;
  }
});

subscriptionPlanSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.availability.isActive &&
         (!this.availability.availableFrom || this.availability.availableFrom <= now) &&
         (!this.availability.availableUntil || this.availability.availableUntil >= now);
});

// Instance methods
subscriptionPlanSchema.methods.canUpgradeFrom = function(planId) {
  return this.upgradeRules.canUpgradeFrom.includes(planId);
};

subscriptionPlanSchema.methods.canDowngradeTo = function(planId) {
  return this.downgradeRules.canDowngradeTo.includes(planId);
};

subscriptionPlanSchema.methods.calculateProrationCredit = function(currentPlan, daysRemaining) {
  if (!currentPlan || daysRemaining <= 0) return 0;
  
  const currentDailyRate = currentPlan.monthlyPrice / 30;
  const newDailyRate = this.monthlyPrice / 30;
  const difference = newDailyRate - currentDailyRate;
  
  return difference * daysRemaining;
};

subscriptionPlanSchema.methods.addSubscriber = function() {
  this.stats.totalSubscribers += 1;
  this.stats.activeSubscribers += 1;
  
  return this.save();
};

subscriptionPlanSchema.methods.removeSubscriber = function(subscriptionDays = 0) {
  this.stats.activeSubscribers = Math.max(0, this.stats.activeSubscribers - 1);
  
  if (subscriptionDays > 0) {
    const totalDays = this.stats.averageSubscriptionLength * this.stats.totalSubscribers;
    this.stats.averageSubscriptionLength = totalDays / this.stats.totalSubscribers;
  }
  
  return this.save();
};

subscriptionPlanSchema.methods.addRevenue = function(amount) {
  this.stats.totalRevenue += amount;
  
  return this.save();
};

subscriptionPlanSchema.methods.updateStats = async function() {
  const Customer = require('./Customer');
  
  const subscribers = await Customer.countDocuments({
    'subscription.planId': this._id,
    'subscription.status': 'active',
    archived: false
  });
  
  const totalSubscribers = await Customer.countDocuments({
    'subscription.planId': this._id,
    archived: false
  });
  
  this.stats.activeSubscribers = subscribers;
  this.stats.totalSubscribers = totalSubscribers;
  
  return this.save();
};

// Static methods
subscriptionPlanSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), archived: false });
};

subscriptionPlanSchema.statics.findAvailable = function() {
  const now = new Date();
  
  return this.find({
    'availability.isActive': true,
    archived: false,
    $or: [
      { 'availability.availableFrom': { $exists: false } },
      { 'availability.availableFrom': { $lte: now } }
    ],
    $or: [
      { 'availability.availableUntil': { $exists: false } },
      { 'availability.availableUntil': { $gte: now } }
    ]
  }).sort({ 'metadata.displayOrder': 1, 'pricing.basePrice': 1 });
};

subscriptionPlanSchema.statics.findByPriceRange = function(minPrice, maxPrice) {
  return this.find({
    'pricing.basePrice': { $gte: minPrice, $lte: maxPrice },
    'availability.isActive': true,
    archived: false
  }).sort({ 'pricing.basePrice': 1 });
};

subscriptionPlanSchema.statics.getPopularPlans = function(limit = 5) {
  return this.find({
    'availability.isActive': true,
    archived: false
  })
  .sort({ 'stats.activeSubscribers': -1, 'metadata.popularPlan': -1 })
  .limit(limit);
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;

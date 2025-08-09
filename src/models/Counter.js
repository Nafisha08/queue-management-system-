const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  number: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 10
  },
  
  // Department Association
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  
  // Counter Configuration
  counterType: {
    type: String,
    enum: ['service', 'consultation', 'payment', 'information', 'priority', 'general'],
    default: 'general'
  },
  
  // Service Types this counter can handle
  serviceTypes: [{
    type: String,
    trim: true
  }],
  
  // Current Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'busy', 'break', 'closed', 'maintenance'],
    default: 'inactive'
  },
  
  // Staff Assignment
  currentOperator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  assignedOperators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Current Token Being Served
  currentToken: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token'
  },
  
  // Last Activity
  lastTokenCalledAt: Date,
  lastServiceCompletedAt: Date,
  
  // Counter Settings
  settings: {
    maxConcurrentTokens: {
      type: Number,
      default: 1
    },
    avgServiceTime: {
      type: Number, // in minutes
      default: 15
    },
    breakDuration: {
      type: Number, // in minutes
      default: 15
    },
    autoCallNext: {
      type: Boolean,
      default: true
    },
    playAnnouncement: {
      type: Boolean,
      default: true
    }
  },
  
  // Display Settings
  displaySettings: {
    displayName: String,
    displayColor: {
      type: String,
      default: '#4CAF50'
    },
    showOnDisplay: {
      type: Boolean,
      default: true
    },
    position: {
      x: Number,
      y: Number
    }
  },
  
  // Statistics
  stats: {
    totalTokensServed: {
      type: Number,
      default: 0
    },
    avgServiceTime: {
      type: Number,
      default: 0
    },
    totalServiceTime: {
      type: Number, // in minutes
      default: 0
    },
    customerSatisfaction: {
      type: Number,
      default: 5.0
    },
    utilization: {
      type: Number, // percentage
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // Working Hours
  workingHours: {
    monday: { start: String, end: String, active: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, active: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, active: { type: Boolean, default: true } },
    thursday: { start: String, end: String, active: { type: Boolean, default: true } },
    friday: { start: String, end: String, active: { type: Boolean, default: true } },
    saturday: { start: String, end: String, active: { type: Boolean, default: false } },
    sunday: { start: String, end: String, active: { type: Boolean, default: false } }
  },
  
  // Hardware Integration
  hardware: {
    ledDisplayId: String,
    audioSystemId: String,
    ticketPrinterId: String,
    callButtonId: String,
    statusLedId: String
  },
  
  // Location
  location: {
    floor: String,
    section: String,
    coordinates: {
      x: Number,
      y: Number
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
counterSchema.index({ department: 1, status: 1 });
counterSchema.index({ code: 1, department: 1 }, { unique: true });
counterSchema.index({ currentOperator: 1, status: 1 });
counterSchema.index({ archived: 1, createdAt: -1 });

// Virtual properties
counterSchema.virtual('isActive').get(function() {
  return ['active', 'busy'].includes(this.status);
});

counterSchema.virtual('isAvailable').get(function() {
  return this.status === 'active' && !this.currentToken;
});

counterSchema.virtual('displayText').get(function() {
  return this.displaySettings.displayName || this.name;
});

counterSchema.virtual('queueLength').get(async function() {
  const Token = require('./Token');
  return await Token.countDocuments({
    counter: this._id,
    status: { $in: ['waiting', 'called'] },
    businessDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  });
});

// Instance methods
counterSchema.methods.assignOperator = function(userId) {
  this.currentOperator = userId;
  if (!this.assignedOperators.includes(userId)) {
    this.assignedOperators.push(userId);
  }
  
  return this.save();
};

counterSchema.methods.removeOperator = function(userId) {
  this.assignedOperators = this.assignedOperators.filter(
    id => id.toString() !== userId.toString()
  );
  
  if (this.currentOperator && this.currentOperator.toString() === userId.toString()) {
    this.currentOperator = undefined;
    this.status = 'inactive';
  }
  
  return this.save();
};

counterSchema.methods.openCounter = function(operatorId) {
  this.status = 'active';
  this.currentOperator = operatorId;
  
  return this.save();
};

counterSchema.methods.closeCounter = function() {
  this.status = 'closed';
  this.currentOperator = undefined;
  this.currentToken = undefined;
  
  return this.save();
};

counterSchema.methods.takeBreak = function(duration) {
  this.status = 'break';
  
  // Auto-resume after break duration
  if (duration) {
    setTimeout(() => {
      this.status = 'active';
      this.save();
    }, duration * 60 * 1000);
  }
  
  return this.save();
};

counterSchema.methods.callNextToken = async function() {
  const Token = require('./Token');
  
  // Find next token in queue for this counter's department
  const nextToken = await Token.findOne({
    department: this.department,
    status: 'waiting',
    businessDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  }).sort({ priority: -1, queuePosition: 1 });
  
  if (!nextToken) {
    return null;
  }
  
  // Call the token
  await nextToken.callToken(this._id, this.currentOperator);
  
  this.currentToken = nextToken._id;
  this.status = 'busy';
  this.lastTokenCalledAt = new Date();
  
  await this.save();
  
  return nextToken;
};

counterSchema.methods.completeCurrentService = async function(notes, rating) {
  if (!this.currentToken) {
    throw new Error('No active token to complete');
  }
  
  const Token = require('./Token');
  const token = await Token.findById(this.currentToken);
  
  if (token) {
    await token.completeService(this.currentOperator, notes, rating);
  }
  
  this.currentToken = undefined;
  this.status = 'active';
  this.lastServiceCompletedAt = new Date();
  
  await this.save();
  
  // Auto-call next token if enabled
  if (this.settings.autoCallNext) {
    setTimeout(() => {
      this.callNextToken();
    }, 2000); // 2 second delay
  }
  
  return token;
};

counterSchema.methods.updateStats = async function() {
  const Token = require('./Token');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const stats = await Token.aggregate([
    {
      $match: {
        counter: this._id,
        status: 'completed',
        businessDate: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: 1 },
        avgServiceTime: { $avg: '$serviceTime' },
        totalServiceTime: { $sum: '$serviceTime' },
        avgSatisfaction: { $avg: '$satisfactionRating' }
      }
    }
  ]);
  
  if (stats.length > 0) {
    const stat = stats[0];
    this.stats.totalTokensServed = stat.totalTokens;
    this.stats.avgServiceTime = Math.round(stat.avgServiceTime || 0);
    this.stats.totalServiceTime = stat.totalServiceTime || 0;
    this.stats.customerSatisfaction = Math.round((stat.avgSatisfaction || 5) * 10) / 10;
    
    // Calculate utilization (8 hours = 480 minutes)
    const workingMinutes = 8 * 60;
    this.stats.utilization = Math.min(100, 
      Math.round((this.stats.totalServiceTime / workingMinutes) * 100)
    );
  }
  
  return this.save();
};

// Static methods
counterSchema.statics.findByDepartment = function(departmentId, includeInactive = false) {
  const query = { department: departmentId, archived: false };
  
  if (!includeInactive) {
    query.status = { $in: ['active', 'busy', 'break'] };
  }
  
  return this.find(query).populate('currentOperator currentToken');
};

counterSchema.statics.findAvailable = function(departmentId) {
  return this.find({
    department: departmentId,
    status: 'active',
    currentToken: { $exists: false },
    archived: false
  }).populate('currentOperator');
};

counterSchema.statics.getDepartmentCounterStats = async function(departmentId, date = new Date()) {
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const counters = await this.find({
    department: departmentId,
    archived: false
  });
  
  const Token = require('./Token');
  
  const results = await Promise.all(
    counters.map(async (counter) => {
      const tokenStats = await Token.aggregate([
        {
          $match: {
            counter: counter._id,
            businessDate: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgServiceTime: { $avg: '$serviceTime' }
          }
        }
      ]);
      
      return {
        counter: counter,
        stats: tokenStats
      };
    })
  );
  
  return results;
};

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;

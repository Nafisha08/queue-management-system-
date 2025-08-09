const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
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
    maxlength: 10,
    match: [/^[A-Z0-9]+$/, 'Code can only contain uppercase letters and numbers']
  },
  
  description: {
    type: String,
    maxlength: 500
  },
  
  // Service Configuration
  serviceTypes: [{
    name: String,
    code: String,
    estimatedServiceTime: {
      type: Number, // in minutes
      default: 15
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    }
  }],
  
  // Operating Hours
  operatingHours: {
    monday: { start: String, end: String, closed: { type: Boolean, default: false } },
    tuesday: { start: String, end: String, closed: { type: Boolean, default: false } },
    wednesday: { start: String, end: String, closed: { type: Boolean, default: false } },
    thursday: { start: String, end: String, closed: { type: Boolean, default: false } },
    friday: { start: String, end: String, closed: { type: Boolean, default: false } },
    saturday: { start: String, end: String, closed: { type: Boolean, default: true } },
    sunday: { start: String, end: String, closed: { type: Boolean, default: true } }
  },
  
  // Queue Settings
  queueSettings: {
    maxQueueSize: {
      type: Number,
      default: 100
    },
    avgServiceTime: {
      type: Number, // in minutes
      default: 15
    },
    maxWaitTime: {
      type: Number, // in minutes
      default: 120
    },
    priorityEnabled: {
      type: Boolean,
      default: true
    },
    transferEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Display Settings
  displaySettings: {
    showEstimatedWaitTime: {
      type: Boolean,
      default: true
    },
    showQueueLength: {
      type: Boolean,
      default: true
    },
    displayColor: {
      type: String,
      default: '#2196F3'
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },
  
  // Staff Assignment
  staff: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['manager', 'operator', 'support'],
      default: 'operator'
    },
    assignedCounters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter'
    }]
  }],
  
  // Statistics
  stats: {
    totalTokensIssued: {
      type: Number,
      default: 0
    },
    avgWaitTime: {
      type: Number,
      default: 0
    },
    avgServiceTime: {
      type: Number,
      default: 0
    },
    customerSatisfaction: {
      type: Number,
      default: 5.0
    },
    utilization: {
      type: Number, // percentage
      default: 0
    }
  },
  
  // Location and Contact
  location: {
    floor: String,
    building: String,
    room: String,
    address: String
  },
  
  contactInfo: {
    phone: String,
    email: String,
    extension: String
  },
  
  // System Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'closed'],
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
departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ status: 1, archived: 1 });
departmentSchema.index({ createdBy: 1, status: 1 });
departmentSchema.index({ 'displaySettings.displayOrder': 1 });

// Virtual properties
departmentSchema.virtual('isOpen').get(function() {
  if (this.status !== 'active') return false;
  
  const now = new Date();
  const day = now.toLocaleDateString('en', { weekday: 'lowercase' });
  const currentTime = now.toTimeString().slice(0, 5);
  
  const todayHours = this.operatingHours[day];
  if (!todayHours || todayHours.closed) return false;
  
  return currentTime >= todayHours.start && currentTime <= todayHours.end;
});

departmentSchema.virtual('currentQueueLength').get(async function() {
  const Token = require('./Token');
  return await Token.countDocuments({
    department: this._id,
    status: { $in: ['waiting', 'called'] },
    businessDate: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  });
});

departmentSchema.virtual('estimatedWaitTime').get(function() {
  return Math.ceil(this.currentQueueLength * this.queueSettings.avgServiceTime);
});

// Instance methods
departmentSchema.methods.addServiceType = function(name, code, estimatedTime = 15, priority = 5) {
  this.serviceTypes.push({
    name,
    code: code.toUpperCase(),
    estimatedServiceTime: estimatedTime,
    priority
  });
  
  return this.save();
};

departmentSchema.methods.assignStaff = function(userId, role = 'operator', counters = []) {
  const existingStaff = this.staff.find(s => s.user.toString() === userId.toString());
  
  if (existingStaff) {
    existingStaff.role = role;
    existingStaff.assignedCounters = counters;
  } else {
    this.staff.push({
      user: userId,
      role,
      assignedCounters: counters
    });
  }
  
  return this.save();
};

departmentSchema.methods.removeStaff = function(userId) {
  this.staff = this.staff.filter(s => s.user.toString() !== userId.toString());
  return this.save();
};

departmentSchema.methods.updateStats = async function() {
  const Token = require('./Token');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const stats = await Token.aggregate([
    {
      $match: {
        department: this._id,
        businessDate: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: 1 },
        avgWaitTime: { $avg: '$waitTime' },
        avgServiceTime: { $avg: '$serviceTime' },
        avgSatisfaction: { $avg: '$satisfactionRating' },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  if (stats.length > 0) {
    const stat = stats[0];
    this.stats.totalTokensIssued = stat.totalTokens;
    this.stats.avgWaitTime = Math.round(stat.avgWaitTime || 0);
    this.stats.avgServiceTime = Math.round(stat.avgServiceTime || 0);
    this.stats.customerSatisfaction = Math.round((stat.avgSatisfaction || 5) * 10) / 10;
    
    // Calculate utilization
    const totalPossibleTime = 8 * 60; // 8 hours in minutes
    const totalServiceTime = stat.completed * this.stats.avgServiceTime;
    this.stats.utilization = Math.min(100, Math.round((totalServiceTime / totalPossibleTime) * 100));
  }
  
  return this.save();
};

// Static methods
departmentSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), archived: false });
};

departmentSchema.statics.findActive = function() {
  return this.find({ status: 'active', archived: false })
    .sort({ 'displaySettings.displayOrder': 1, name: 1 });
};

departmentSchema.statics.findOpenDepartments = function() {
  return this.find({ status: 'active', archived: false })
    .then(departments => {
      return departments.filter(dept => dept.isOpen);
    });
};

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;

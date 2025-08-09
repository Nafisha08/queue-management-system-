const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false // Don't include password in queries by default
  },
  
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
  
  // Profile Information
  profile: {
    avatar: String,
    bio: {
      type: String,
      maxlength: 500
    },
    department: String,
    title: String,
    location: String,
    timezone: {
      type: String,
      default: 'UTC'
    },
    phone: String,
    skills: [String],
    languages: [String]
  },
  
  // Role and Permissions
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'admin', 'sub_admin', 'user'],
    default: 'user'
  },
  
  permissions: {
    canCreateQueues: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    },
    canViewAllProjects: {
      type: Boolean,
      default: false
    },
    canModifySystemSettings: {
      type: Boolean,
      default: false
    },
    maxConcurrentProjects: {
      type: Number,
      default: 3,
      min: 1
    }
  },
  
  // Work Preferences
  preferences: {
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      },
      timezone: {
        type: String,
        default: 'UTC'
      }
    },
    workingDays: {
      type: [String],
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    autoAssign: {
      type: Boolean,
      default: false
    },
    preferredCategories: [String],
    maxPriorityLevel: {
      type: Number,
      min: 1,
      max: 10,
      default: 10
    },
    notifications: {
      email: {
        projectAssigned: {
          type: Boolean,
          default: true
        },
        projectDue: {
          type: Boolean,
          default: true
        },
        projectCompleted: {
          type: Boolean,
          default: false
        },
        weeklyDigest: {
          type: Boolean,
          default: true
        }
      },
      inApp: {
        projectAssigned: {
          type: Boolean,
          default: true
        },
        projectDue: {
          type: Boolean,
          default: true
        },
        mentions: {
          type: Boolean,
          default: true
        }
      }
    }
  },
  
  // Status and Activity
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'busy', 'away'],
    default: 'active'
  },
  
  availability: {
    type: String,
    enum: ['available', 'busy', 'away', 'do_not_disturb'],
    default: 'available'
  },
  
  currentWorkload: {
    assignedProjects: {
      type: Number,
      default: 0
    },
    inProgressProjects: {
      type: Number,
      default: 0
    },
    estimatedHours: {
      type: Number,
      default: 0
    }
  },
  
  // Statistics
  stats: {
    totalProjectsCompleted: {
      type: Number,
      default: 0
    },
    totalProjectsAssigned: {
      type: Number,
      default: 0
    },
    averageCompletionTime: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 5,
      min: 1,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  
  // Authentication
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: Date,
  
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  emailVerificationToken: String,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: Date,
  
  // API and Integrations
  apiKeys: [{
    name: String,
    key: String,
    permissions: [String],
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: Date,
    expiresAt: Date,
    active: {
      type: Boolean,
      default: true
    }
  }],
  
  integrations: {
    slack: {
      userId: String,
      webhook: String,
      enabled: {
        type: Boolean,
        default: false
      }
    },
    teams: {
      userId: String,
      webhook: String,
      enabled: {
        type: Boolean,
        default: false
      }
    },
    discord: {
      userId: String,
      webhook: String,
      enabled: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // Archival
  archived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ status: 1, availability: 1 });
userSchema.index({ 'profile.department': 1 });
userSchema.index({ archived: 1, createdAt: -1 });

// Virtual properties
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isAccountLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('workloadPercentage').get(function() {
  const maxProjects = this.permissions.maxConcurrentProjects;
  return maxProjects > 0 ? (this.currentWorkload.inProgressProjects / maxProjects) * 100 : 0;
});

userSchema.virtual('isAvailableForWork').get(function() {
  return this.status === 'active' && 
         this.availability === 'available' && 
         this.currentWorkload.inProgressProjects < this.permissions.maxConcurrentProjects &&
         !this.isAccountLocked;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
  
  // Set role-based permissions
  if (this.isModified('role')) {
    switch (this.role) {
      case 'super_admin':
        // Super Admin has all permissions
        this.permissions.canCreateQueues = true;
        this.permissions.canManageUsers = true;
        this.permissions.canViewAllProjects = true;
        this.permissions.canModifySystemSettings = true;
        this.permissions.maxConcurrentProjects = 50;
        break;
      case 'admin':
        // Admin has most permissions except super admin functions
        this.permissions.canCreateQueues = true;
        this.permissions.canManageUsers = true;
        this.permissions.canViewAllProjects = true;
        this.permissions.canModifySystemSettings = false;
        this.permissions.maxConcurrentProjects = 20;
        break;
      case 'sub_admin':
        // Sub Admin has limited management permissions
        this.permissions.canCreateQueues = true;
        this.permissions.canManageUsers = false;
        this.permissions.canViewAllProjects = true;
        this.permissions.canModifySystemSettings = false;
        this.permissions.maxConcurrentProjects = 10;
        break;
      case 'user':
        // Regular user has basic permissions
        this.permissions.canCreateQueues = false;
        this.permissions.canManageUsers = false;
        this.permissions.canViewAllProjects = false;
        this.permissions.canModifySystemSettings = false;
        this.permissions.maxConcurrentProjects = 3;
        break;
    }
  }
  
  // Update email verification status
  if (this.isModified('email') && !this.isNew) {
    this.emailVerified = false;
    this.emailVerifiedAt = null;
  }
  
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have exceeded max attempts and it's not locked already, lock the account
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isAccountLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.updateWorkload = async function() {
  const Project = require('./Project');
  
  const stats = await Project.aggregate([
    { $match: { assignedTo: this._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$totalEstimatedHours' }
      }
    }
  ]);
  
  let assigned = 0;
  let inProgress = 0;
  let estimatedHours = 0;
  
  stats.forEach(stat => {
    assigned += stat.count;
    if (['queued', 'in_progress', 'review', 'testing'].includes(stat._id)) {
      inProgress += stat.count;
      estimatedHours += stat.totalHours || 0;
    }
  });
  
  this.currentWorkload.assignedProjects = assigned;
  this.currentWorkload.inProgressProjects = inProgress;
  this.currentWorkload.estimatedHours = estimatedHours;
  
  return this.save();
};

userSchema.methods.updateStats = async function() {
  const Project = require('./Project');
  
  const stats = await Project.aggregate([
    { $match: { assignedTo: this._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgTime: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$startedAt', null] }, { $ne: ['$completedAt', null] }] },
              { $subtract: ['$completedAt', '$startedAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
  
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let avgCompletionTime = 0;
  
  stats.forEach(stat => {
    totalAssigned += stat.count;
    if (stat._id === 'completed') {
      totalCompleted = stat.count;
      avgCompletionTime = stat.avgTime || 0;
    } else if (stat._id === 'failed') {
      totalFailed = stat.count;
    }
  });
  
  this.stats.totalProjectsAssigned = totalAssigned;
  this.stats.totalProjectsCompleted = totalCompleted;
  this.stats.averageCompletionTime = avgCompletionTime;
  
  // Calculate success rate
  if (totalAssigned > 0) {
    this.stats.successRate = ((totalCompleted / (totalCompleted + totalFailed)) * 100) || 100;
  }
  
  return this.save();
};

userSchema.methods.generateAPIKey = function(name, permissions = []) {
  const crypto = require('crypto');
  const key = crypto.randomBytes(32).toString('hex');
  
  this.apiKeys.push({
    name,
    key,
    permissions,
    createdAt: new Date()
  });
  
  return this.save().then(() => key);
};

userSchema.methods.revokeAPIKey = function(keyId) {
  const apiKey = this.apiKeys.id(keyId);
  if (apiKey) {
    apiKey.active = false;
    return this.save();
  }
  throw new Error('API key not found');
};

// Static methods
userSchema.statics.findByRole = function(role, includeArchived = false) {
  const query = { role };
  if (!includeArchived) {
    query.archived = false;
  }
  return this.find(query);
};

userSchema.statics.findAvailableWorkers = function(maxWorkload = 100) {
  return this.find({
    role: { $in: ['worker', 'manager'] },
    status: 'active',
    availability: 'available',
    archived: false,
    $expr: {
      $lt: [
        { $multiply: [
          { $divide: ['$currentWorkload.inProgressProjects', '$permissions.maxConcurrentProjects'] },
          100
        ]},
        maxWorkload
      ]
    }
  });
};

userSchema.statics.authenticate = async function(identifier, password) {
  // Find user by username or email
  const user = await this.findOne({
    $or: [
      { username: identifier },
      { email: identifier }
    ],
    archived: false
  }).select('+password');
  
  if (!user || user.isAccountLocked) {
    return null;
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incrementLoginAttempts();
    return null;
  }
  
  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }
  
  // Update last login
  user.lastLogin = new Date();
  await user.save();
  
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

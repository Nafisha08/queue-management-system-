const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Queue Configuration
  type: {
    type: String,
    required: true,
    enum: [
      'fifo',         // First In, First Out
      'lifo',         // Last In, First Out (Stack)
      'priority',     // Priority-based
      'weighted',     // Weighted priority
      'round_robin',  // Round robin
      'custom'        // Custom algorithm
    ],
    default: 'priority'
  },
  
  capacity: {
    type: Number,
    required: true,
    min: 1,
    default: 1000
  },
  
  // Status and State
  status: {
    type: String,
    required: true,
    enum: ['active', 'paused', 'disabled', 'maintenance'],
    default: 'active'
  },
  
  // Processing Configuration
  concurrency: {
    type: Number,
    min: 1,
    default: 1,
    max: 100
  },
  
  processingRules: {
    autoAssign: {
      type: Boolean,
      default: false
    },
    autoStart: {
      type: Boolean,
      default: false
    },
    allowDuplicates: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    }
  },
  
  // Queue Policies
  policies: {
    maxRetries: {
      type: Number,
      min: 0,
      default: 3
    },
    timeout: {
      type: Number, // in milliseconds
      min: 0,
      default: 3600000 // 1 hour
    },
    priorityWeights: {
      high: {
        type: Number,
        default: 3
      },
      medium: {
        type: Number,
        default: 2
      },
      low: {
        type: Number,
        default: 1
      }
    }
  },
  
  // Resource Limits
  resourceLimits: {
    maxCpuPerProject: {
      type: Number,
      min: 0,
      default: 4
    },
    maxMemoryPerProject: {
      type: Number,
      min: 0,
      default: 8 // GB
    },
    maxStoragePerProject: {
      type: Number,
      min: 0,
      default: 100 // GB
    },
    totalCpuLimit: {
      type: Number,
      min: 0,
      default: 16
    },
    totalMemoryLimit: {
      type: Number,
      min: 0,
      default: 32
    }
  },
  
  // Queue Statistics
  stats: {
    totalProcessed: {
      type: Number,
      default: 0
    },
    currentSize: {
      type: Number,
      default: 0
    },
    processing: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    averageProcessingTime: {
      type: Number,
      default: 0
    },
    lastProcessedAt: {
      type: Date,
      default: null
    }
  },
  
  // Access Control
  permissions: {
    owners: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    managers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    workers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    viewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  
  // Queue Filters and Criteria
  acceptanceCriteria: {
    categories: [{
      type: String
    }],
    minPriority: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    maxPriority: {
      type: Number,
      min: 1,
      max: 10,
      default: 10
    },
    tags: [{
      type: String
    }],
    customRules: [{
      field: String,
      operator: {
        type: String,
        enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex']
      },
      value: mongoose.Schema.Types.Mixed
    }]
  },
  
  // Scheduling
  schedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    pattern: String, // Cron pattern
    timezone: {
      type: String,
      default: 'UTC'
    },
    nextRun: Date,
    lastRun: Date
  },
  
  // Notifications
  notifications: {
    onProjectAdded: {
      type: Boolean,
      default: false
    },
    onProjectCompleted: {
      type: Boolean,
      default: false
    },
    onProjectFailed: {
      type: Boolean,
      default: true
    },
    onQueueEmpty: {
      type: Boolean,
      default: false
    },
    onQueueFull: {
      type: Boolean,
      default: true
    },
    webhookUrl: String,
    emailNotifications: [String]
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
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
queueSchema.index({ name: 1 }, { unique: true });
queueSchema.index({ status: 1, type: 1 });
queueSchema.index({ 'permissions.owners': 1 });
queueSchema.index({ 'permissions.managers': 1 });
queueSchema.index({ 'permissions.workers': 1 });
queueSchema.index({ createdBy: 1 });
queueSchema.index({ archived: 1, createdAt: -1 });

// Virtual properties
queueSchema.virtual('utilizationPercentage').get(function() {
  return this.capacity > 0 ? (this.stats.currentSize / this.capacity) * 100 : 0;
});

queueSchema.virtual('availableSlots').get(function() {
  return Math.max(0, this.capacity - this.stats.currentSize);
});

queueSchema.virtual('processingCapacity').get(function() {
  return Math.max(0, this.concurrency - this.stats.processing);
});

// Instance methods
queueSchema.methods.canAcceptProject = function(project) {
  // Check capacity
  if (this.stats.currentSize >= this.capacity) {
    return { canAccept: false, reason: 'Queue is at full capacity' };
  }
  
  // Check status
  if (this.status !== 'active') {
    return { canAccept: false, reason: 'Queue is not active' };
  }
  
  // Check priority range
  if (project.priority < this.acceptanceCriteria.minPriority || 
      project.priority > this.acceptanceCriteria.maxPriority) {
    return { canAccept: false, reason: 'Project priority is outside acceptable range' };
  }
  
  // Check categories
  if (this.acceptanceCriteria.categories.length > 0 && 
      !this.acceptanceCriteria.categories.includes(project.category)) {
    return { canAccept: false, reason: 'Project category is not accepted by this queue' };
  }
  
  // Check tags
  if (this.acceptanceCriteria.tags.length > 0) {
    const hasMatchingTag = project.tags.some(tag => this.acceptanceCriteria.tags.includes(tag));
    if (!hasMatchingTag) {
      return { canAccept: false, reason: 'Project does not have required tags' };
    }
  }
  
  return { canAccept: true, reason: 'Project meets all acceptance criteria' };
};

queueSchema.methods.addProject = async function(project) {
  const acceptanceCheck = this.canAcceptProject(project);
  if (!acceptanceCheck.canAccept) {
    throw new Error(acceptanceCheck.reason);
  }
  
  // Update queue stats
  this.stats.currentSize += 1;
  
  // Set queue position based on queue type
  let position;
  switch (this.type) {
    case 'fifo':
      position = this.stats.currentSize;
      break;
    case 'lifo':
      position = 1;
      // Update other projects' positions
      await mongoose.model('Project').updateMany(
        { queueId: this._id, queuePosition: { $gte: 1 } },
        { $inc: { queuePosition: 1 } }
      );
      break;
    case 'priority':
    case 'weighted':
      // Find appropriate position based on priority
      const higherPriorityCount = await mongoose.model('Project').countDocuments({
        queueId: this._id,
        priority: { $gt: project.priority },
        status: 'queued'
      });
      position = higherPriorityCount + 1;
      
      // Update positions of lower priority projects
      await mongoose.model('Project').updateMany(
        { 
          queueId: this._id, 
          priority: { $lte: project.priority },
          queuePosition: { $gte: position }
        },
        { $inc: { queuePosition: 1 } }
      );
      break;
    default:
      position = this.stats.currentSize;
  }
  
  // Update project
  project.queueId = this._id;
  project.queuePosition = position;
  project.status = 'queued';
  
  await project.save();
  await this.save();
  
  return position;
};

queueSchema.methods.removeProject = async function(project) {
  if (project.queueId.toString() !== this._id.toString()) {
    throw new Error('Project is not in this queue');
  }
  
  // Update positions of projects after the removed one
  await mongoose.model('Project').updateMany(
    { 
      queueId: this._id,
      queuePosition: { $gt: project.queuePosition }
    },
    { $inc: { queuePosition: -1 } }
  );
  
  // Update queue stats
  this.stats.currentSize = Math.max(0, this.stats.currentSize - 1);
  
  // Clear project queue info
  project.queueId = null;
  project.queuePosition = null;
  
  await project.save();
  await this.save();
};

queueSchema.methods.getNextProject = async function() {
  const Project = mongoose.model('Project');
  
  switch (this.type) {
    case 'fifo':
    case 'priority':
    case 'weighted':
      return await Project.findOne({
        queueId: this._id,
        status: 'queued'
      }).sort({ queuePosition: 1 });
      
    case 'lifo':
      return await Project.findOne({
        queueId: this._id,
        status: 'queued'
      }).sort({ queuePosition: -1 });
      
    default:
      return await Project.findOne({
        queueId: this._id,
        status: 'queued'
      }).sort({ priority: -1, createdAt: 1 });
  }
};

queueSchema.methods.updateStats = async function() {
  const Project = mongoose.model('Project');
  
  const stats = await Project.aggregate([
    { $match: { queueId: this._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: {
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
  
  // Reset stats
  this.stats.currentSize = 0;
  this.stats.processing = 0;
  this.stats.completed = 0;
  this.stats.failed = 0;
  
  // Update from aggregation
  stats.forEach(stat => {
    switch (stat._id) {
      case 'queued':
        this.stats.currentSize = stat.count;
        break;
      case 'in_progress':
        this.stats.processing = stat.count;
        break;
      case 'completed':
        this.stats.completed += stat.count;
        break;
      case 'failed':
        this.stats.failed += stat.count;
        break;
    }
    
    if (stat.avgProcessingTime) {
      this.stats.averageProcessingTime = stat.avgProcessingTime;
    }
  });
  
  await this.save();
};

// Static methods
queueSchema.statics.findByUser = function(userId, role = 'viewers') {
  const query = {};
  query[`permissions.${role}`] = userId;
  
  return this.find({
    $or: [
      query,
      { createdBy: userId }
    ],
    archived: false
  });
};

queueSchema.statics.findActive = function() {
  return this.find({ status: 'active', archived: false });
};

const Queue = mongoose.model('Queue', queueSchema);

module.exports = Queue;

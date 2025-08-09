const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Project Classification
  category: {
    type: String,
    required: true,
    enum: [
      'development',
      'research',
      'maintenance',
      'testing',
      'deployment',
      'documentation',
      'security',
      'infrastructure',
      'analytics',
      'other'
    ],
    default: 'development'
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Priority and Scheduling
  priority: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 5
  },
  
  estimatedDuration: {
    hours: {
      type: Number,
      min: 0,
      default: 0
    },
    days: {
      type: Number,
      min: 0,
      default: 0
    },
    weeks: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  // Status Management
  status: {
    type: String,
    required: true,
    enum: [
      'pending',      // Waiting to be processed
      'queued',       // In queue
      'in_progress',  // Currently being worked on
      'on_hold',      // Temporarily paused
      'review',       // Under review
      'testing',      // In testing phase
      'completed',    // Successfully finished
      'cancelled',    // Cancelled before completion
      'failed'        // Failed to complete
    ],
    default: 'pending'
  },
  
  // Queue Information
  queuePosition: {
    type: Number,
    default: null
  },
  
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Queue',
    default: null
  },
  
  // Assignment and Ownership
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Dependencies
  dependencies: [{
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    type: {
      type: String,
      enum: ['blocking', 'related', 'child', 'parent'],
      default: 'related'
    }
  }],
  
  // Dates and Deadlines
  deadline: {
    type: Date,
    default: null
  },
  
  startedAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  // Resource Requirements
  resources: {
    cpu: {
      type: Number,
      min: 0,
      default: 1
    },
    memory: {
      type: Number,
      min: 0,
      default: 1
    },
    storage: {
      type: Number,
      min: 0,
      default: 0
    },
    custom: [{
      name: String,
      value: Number,
      unit: String
    }]
  },
  
  // Progress Tracking
  progress: {
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    milestones: [{
      name: String,
      description: String,
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date
    }]
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
projectSchema.index({ status: 1, priority: -1 });
projectSchema.index({ queueId: 1, queuePosition: 1 });
projectSchema.index({ assignedTo: 1, status: 1 });
projectSchema.index({ createdBy: 1, createdAt: -1 });
projectSchema.index({ category: 1, status: 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ deadline: 1 });
projectSchema.index({ archived: 1, createdAt: -1 });

// Virtual for total estimated hours
projectSchema.virtual('totalEstimatedHours').get(function() {
  const { hours = 0, days = 0, weeks = 0 } = this.estimatedDuration;
  return hours + (days * 8) + (weeks * 40); // Assuming 8 hours/day, 40 hours/week
});

// Virtual for elapsed time since creation
projectSchema.virtual('elapsedTime').get(function() {
  const now = new Date();
  const created = this.createdAt;
  return now.getTime() - created.getTime();
});

// Virtual for time until deadline
projectSchema.virtual('timeToDeadline').get(function() {
  if (!this.deadline) return null;
  const now = new Date();
  return this.deadline.getTime() - now.getTime();
});

// Pre-save middleware
projectSchema.pre('save', function(next) {
  // Auto-set completion date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
    this.progress.percentage = 100;
  }
  
  // Set started date when status changes to in_progress
  if (this.isModified('status') && this.status === 'in_progress' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  // Archive projects when status is completed or cancelled
  if (this.isModified('status') && ['completed', 'cancelled', 'failed'].includes(this.status)) {
    this.archived = true;
    this.archivedAt = new Date();
  }
  
  next();
});

// Static methods
projectSchema.statics.findByStatus = function(status) {
  return this.find({ status, archived: false }).populate('assignedTo createdBy queueId');
};

projectSchema.statics.findByPriority = function(minPriority = 1) {
  return this.find({ 
    priority: { $gte: minPriority }, 
    archived: false 
  }).sort({ priority: -1, createdAt: 1 });
};

projectSchema.statics.findOverdue = function() {
  const now = new Date();
  return this.find({
    deadline: { $lt: now },
    status: { $nin: ['completed', 'cancelled', 'failed'] },
    archived: false
  });
};

// Instance methods
projectSchema.methods.updateProgress = function(percentage) {
  this.progress.percentage = Math.min(100, Math.max(0, percentage));
  return this.save();
};

projectSchema.methods.addMilestone = function(name, description) {
  this.progress.milestones.push({ name, description });
  return this.save();
};

projectSchema.methods.completeMilestone = function(milestoneId) {
  const milestone = this.progress.milestones.id(milestoneId);
  if (milestone) {
    milestone.completed = true;
    milestone.completedAt = new Date();
    return this.save();
  }
  throw new Error('Milestone not found');
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;

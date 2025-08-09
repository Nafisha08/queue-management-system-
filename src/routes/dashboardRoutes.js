const express = require('express');
const Project = require('../models/Project');
const Queue = require('../models/Queue');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @desc    Get dashboard overview
 * @route   GET /api/v1/dashboard
 * @access  Private
 */
router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    const isAdmin = user.role === 'admin';
    const canViewAll = user.permissions.canViewAllProjects;

    // Build base query for user's accessible data
    let projectQuery = { archived: false };
    if (!isAdmin && !canViewAll) {
      projectQuery.$or = [
        { createdBy: user._id },
        { assignedTo: user._id }
      ];
    }

    // Get project statistics
    const projectStats = await Project.aggregate([
      { $match: projectQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const projectStatusCounts = {
      pending: 0,
      queued: 0,
      in_progress: 0,
      on_hold: 0,
      review: 0,
      testing: 0,
      completed: 0,
      cancelled: 0,
      failed: 0
    };

    projectStats.forEach(stat => {
      projectStatusCounts[stat._id] = stat.count;
    });

    // Get priority distribution
    const priorityStats = await Project.aggregate([
      { $match: projectQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get overdue projects count
    const overdueCount = await Project.countDocuments({
      ...projectQuery,
      deadline: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled', 'failed'] }
    });

    // Get user's assigned projects (top 5 by priority)
    const userProjects = await Project.find({
      assignedTo: user._id,
      status: { $nin: ['completed', 'cancelled', 'failed'] },
      archived: false
    })
    .populate('queueId', 'name type')
    .sort({ priority: -1, deadline: 1 })
    .limit(5);

    // Get queue statistics (admin/manager only)
    let queueStats = [];
    if (isAdmin || user.role === 'manager') {
      const queues = await Queue.find({
        archived: false,
        $or: [
          { createdBy: user._id },
          { 'permissions.owners': user._id },
          { 'permissions.managers': user._id },
          { 'permissions.workers': user._id }
        ]
      });

      queueStats = queues.map(queue => ({
        id: queue._id,
        name: queue.name,
        type: queue.type,
        status: queue.status,
        currentSize: queue.stats.currentSize,
        processing: queue.stats.processing,
        capacity: queue.capacity,
        utilizationPercentage: queue.utilizationPercentage
      }));
    }

    // Get recent activity
    const recentProjects = await Project.find(projectQuery)
      .populate('assignedTo createdBy', 'username fullName')
      .populate('queueId', 'name')
      .sort({ updatedAt: -1 })
      .limit(10);

    // Get workload information
    const workloadInfo = {
      assignedProjects: user.currentWorkload.assignedProjects,
      inProgressProjects: user.currentWorkload.inProgressProjects,
      estimatedHours: user.currentWorkload.estimatedHours,
      workloadPercentage: user.workloadPercentage,
      maxConcurrentProjects: user.permissions.maxConcurrentProjects
    };

    // System-wide stats (admin only)
    let systemStats = null;
    if (isAdmin) {
      const totalUsers = await User.countDocuments({ archived: false });
      const activeUsers = await User.countDocuments({ 
        status: 'active', 
        archived: false 
      });
      const totalQueues = await Queue.countDocuments({ archived: false });
      const totalProjects = await Project.countDocuments({ archived: false });

      systemStats = {
        totalUsers,
        activeUsers,
        totalQueues,
        totalProjects
      };
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          availability: user.availability
        },
        projectStats: projectStatusCounts,
        priorityStats,
        overdueCount,
        workloadInfo,
        userProjects,
        queueStats,
        recentActivity: recentProjects,
        systemStats
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get project analytics
 * @route   GET /api/v1/dashboard/projects/analytics
 * @access  Private
 */
router.get('/projects/analytics', async (req, res, next) => {
  try {
    const { period = '30d', category, priority } = req.query;
    const user = req.user;
    const isAdmin = user.role === 'admin';
    const canViewAll = user.permissions.canViewAllProjects;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Build query
    let matchQuery = {
      archived: false,
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (!isAdmin && !canViewAll) {
      matchQuery.$or = [
        { createdBy: user._id },
        { assignedTo: user._id }
      ];
    }

    if (category) matchQuery.category = category;
    if (priority) matchQuery.priority = parseInt(priority);

    // Completion rate over time
    const completionTrend = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Average completion time by category
    const completionTimeByCategory = await Project.aggregate([
      {
        $match: {
          ...matchQuery,
          status: 'completed',
          startedAt: { $ne: null },
          completedAt: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$category',
          avgCompletionTime: {
            $avg: { $subtract: ['$completedAt', '$startedAt'] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Priority distribution and success rates
    const priorityAnalysis = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$priority',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$completed', { $add: ['$completed', '$failed'] }] },
              100
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        completionTrend,
        completionTimeByCategory,
        priorityAnalysis
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get queue analytics
 * @route   GET /api/v1/dashboard/queues/analytics
 * @access  Private (Manager/Admin)
 */
router.get('/queues/analytics', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const user = req.user;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get accessible queues
    const accessibleQueues = await Queue.find({
      archived: false,
      $or: [
        { createdBy: user._id },
        { 'permissions.owners': user._id },
        { 'permissions.managers': user._id }
      ]
    });

    const queueIds = accessibleQueues.map(q => q._id);

    // Queue utilization over time
    const utilizationData = accessibleQueues.map(queue => ({
      queueId: queue._id,
      queueName: queue.name,
      currentUtilization: queue.utilizationPercentage,
      capacity: queue.capacity,
      currentSize: queue.stats.currentSize,
      processing: queue.stats.processing,
      throughput: queue.stats.averageProcessingTime > 0 ? 
        (1000 * 60 * 60 * 24) / queue.stats.averageProcessingTime : 0 // Projects per day
    }));

    // Projects processed by queue
    const projectsByQueue = await Project.aggregate([
      {
        $match: {
          queueId: { $in: queueIds },
          updatedAt: { $gte: startDate, $lte: endDate },
          archived: false
        }
      },
      {
        $group: {
          _id: '$queueId',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          avgPriority: { $avg: '$priority' }
        }
      }
    ]);

    // Populate queue names
    const projectsWithQueueNames = await Promise.all(
      projectsByQueue.map(async (item) => {
        const queue = accessibleQueues.find(q => q._id.toString() === item._id.toString());
        return {
          ...item,
          queueName: queue ? queue.name : 'Unknown Queue'
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        utilizationData,
        projectsByQueue: projectsWithQueueNames
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get user performance analytics
 * @route   GET /api/v1/dashboard/users/analytics
 * @access  Private (Admin only)
 */
router.get('/users/analytics', authorize('admin'), async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // User performance metrics
    const userPerformance = await Project.aggregate([
      {
        $match: {
          assignedTo: { $ne: null },
          updatedAt: { $gte: startDate, $lte: endDate },
          archived: false
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          avgCompletionTime: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$startedAt', null] },
                    { $ne: ['$completedAt', null] }
                  ]
                },
                { $subtract: ['$completedAt', '$startedAt'] },
                null
              ]
            }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $cond: [
              { $gt: [{ $add: ['$completed', '$failed'] }, 0] },
              {
                $multiply: [
                  { $divide: ['$completed', { $add: ['$completed', '$failed'] }] },
                  100
                ]
              },
              100
            ]
          }
        }
      }
    ]);

    // Populate user information
    const userIds = userPerformance.map(u => u._id);
    const users = await User.find({ _id: { $in: userIds } }, 'username fullName role');
    
    const performanceWithUserInfo = userPerformance.map(perf => {
      const user = users.find(u => u._id.toString() === perf._id.toString());
      return {
        ...perf,
        user: user ? {
          username: user.username,
          fullName: user.fullName,
          role: user.role
        } : null
      };
    }).sort((a, b) => b.successRate - a.successRate);

    // Department performance
    const departmentPerformance = await User.aggregate([
      {
        $match: {
          archived: false,
          'profile.department': { $ne: null, $ne: '' }
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'assignedProjects',
          pipeline: [
            {
              $match: {
                updatedAt: { $gte: startDate, $lte: endDate },
                archived: false
              }
            }
          ]
        }
      },
      {
        $group: {
          _id: '$profile.department',
          userCount: { $sum: 1 },
          totalProjects: { $sum: { $size: '$assignedProjects' } },
          completedProjects: {
            $sum: {
              $size: {
                $filter: {
                  input: '$assignedProjects',
                  cond: { $eq: ['$$this.status', 'completed'] }
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          avgProjectsPerUser: { $divide: ['$totalProjects', '$userCount'] },
          completionRate: {
            $cond: [
              { $gt: ['$totalProjects', 0] },
              { $multiply: [{ $divide: ['$completedProjects', '$totalProjects'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        userPerformance: performanceWithUserInfo,
        departmentPerformance
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

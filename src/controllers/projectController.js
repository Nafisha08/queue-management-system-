const Project = require('../models/Project');
const Queue = require('../models/Queue');
const User = require('../models/User');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');

/**
 * @desc    Get all projects
 * @route   GET /api/v1/projects
 * @access  Private
 */
const getProjects = async (req, res, next) => {
  try {
    const {
      status,
      category,
      priority,
      assignedTo,
      createdBy,
      tags,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = { archived: false };

    // Role-based access control
    const user = req.user;
    if (user.role !== 'admin' && !user.permissions.canViewAllProjects) {
      query.$or = [
        { createdBy: user._id },
        { assignedTo: user._id }
      ];
    }

    // Apply filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = parseInt(priority);
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;
    if (tags) query.tags = { $in: tags.split(',') };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const projects = await Project.find(query)
      .populate('assignedTo', 'username fullName email')
      .populate('createdBy', 'username fullName email')
      .populate('queueId', 'name type status')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Project.countDocuments(query);

    res.status(200).json({
      success: true,
      data: projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single project
 * @route   GET /api/v1/projects/:id
 * @access  Private
 */
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedTo', 'username fullName email profile')
      .populate('createdBy', 'username fullName email')
      .populate('queueId', 'name type status capacity')
      .populate('dependencies.project', 'name status priority');

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Access control
    const user = req.user;
    const hasAccess = user.role === 'admin' ||
                      user.permissions.canViewAllProjects ||
                      project.createdBy._id.toString() === user._id.toString() ||
                      project.assignedTo?._id.toString() === user._id.toString();

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new project
 * @route   POST /api/v1/projects
 * @access  Private
 */
const createProject = async (req, res, next) => {
  try {
    const projectData = {
      ...req.body,
      createdBy: req.user._id
    };

    const project = await Project.create(projectData);

    // Populate the created project
    await project.populate('createdBy', 'username fullName email');

    logger.info(`Project created: ${project.name} by user ${req.user.username}`);

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update project
 * @route   PUT /api/v1/projects/:id
 * @access  Private
 */
const updateProject = async (req, res, next) => {
  try {
    let project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Access control
    const user = req.user;
    const canModify = user.role === 'admin' ||
                      project.createdBy.toString() === user._id.toString() ||
                      project.assignedTo?.toString() === user._id.toString();

    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Don't allow changing certain fields directly
    const protectedFields = ['createdBy', 'queueId', 'queuePosition'];
    protectedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        delete req.body[field];
      }
    });

    project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('assignedTo createdBy queueId');

    // Update assigned user's workload if assignment changed
    if (req.body.assignedTo && project.assignedTo) {
      const assignedUser = await User.findById(project.assignedTo);
      if (assignedUser) {
        await assignedUser.updateWorkload();
      }
    }

    logger.info(`Project updated: ${project.name} by user ${user.username}`);

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete project
 * @route   DELETE /api/v1/projects/:id
 * @access  Private
 */
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Access control
    const user = req.user;
    const canDelete = user.role === 'admin' ||
                      project.createdBy.toString() === user._id.toString();

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Remove from queue if in one
    if (project.queueId) {
      const queue = await Queue.findById(project.queueId);
      if (queue) {
        await queue.removeProject(project);
      }
    }

    await project.deleteOne();

    logger.info(`Project deleted: ${project.name} by user ${user.username}`);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add project to queue
 * @route   POST /api/v1/projects/:id/queue
 * @access  Private
 */
const addToQueue = async (req, res, next) => {
  try {
    const { queueId } = req.body;
    const projectId = req.params.id;
    const userId = req.user._id;

    const result = await queueService.addProjectToQueue(queueId, projectId, userId);

    res.status(200).json({
      success: true,
      data: result,
      message: `Project added to queue at position ${result.position}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove project from queue
 * @route   DELETE /api/v1/projects/:id/queue
 * @access  Private
 */
const removeFromQueue = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.queueId) {
      return res.status(400).json({
        success: false,
        error: 'Project is not in a queue'
      });
    }

    const result = await queueService.removeProjectFromQueue(
      project.queueId.toString(),
      req.params.id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Project removed from queue'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update project progress
 * @route   PUT /api/v1/projects/:id/progress
 * @access  Private
 */
const updateProgress = async (req, res, next) => {
  try {
    const { percentage } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Access control
    const user = req.user;
    const canUpdate = user.role === 'admin' ||
                      project.createdBy.toString() === user._id.toString() ||
                      project.assignedTo?.toString() === user._id.toString();

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await project.updateProgress(percentage);

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add milestone to project
 * @route   POST /api/v1/projects/:id/milestones
 * @access  Private
 */
const addMilestone = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Access control
    const user = req.user;
    const canAdd = user.role === 'admin' ||
                   project.createdBy.toString() === user._id.toString() ||
                   project.assignedTo?.toString() === user._id.toString();

    if (!canAdd) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await project.addMilestone(name, description);

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete milestone
 * @route   PUT /api/v1/projects/:id/milestones/:milestoneId/complete
 * @access  Private
 */
const completeMilestone = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Access control
    const user = req.user;
    const canComplete = user.role === 'admin' ||
                        project.createdBy.toString() === user._id.toString() ||
                        project.assignedTo?.toString() === user._id.toString();

    if (!canComplete) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await project.completeMilestone(req.params.milestoneId);

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get project statistics
 * @route   GET /api/v1/projects/stats
 * @access  Private
 */
const getProjectStats = async (req, res, next) => {
  try {
    const user = req.user;
    let matchQuery = { archived: false };

    // Role-based access control
    if (user.role !== 'admin' && !user.permissions.canViewAllProjects) {
      matchQuery.$or = [
        { createdBy: user._id },
        { assignedTo: user._id }
      ];
    }

    const stats = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgPriority: { $avg: '$priority' },
          totalEstimatedHours: { $sum: '$totalEstimatedHours' }
        }
      }
    ]);

    const categoryStats = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Project.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const overdue = await Project.find({
      ...matchQuery,
      deadline: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled', 'failed'] }
    }).countDocuments();

    res.status(200).json({
      success: true,
      data: {
        statusDistribution: stats,
        categoryDistribution: categoryStats,
        priorityDistribution: priorityStats,
        overdueCount: overdue,
        totalProjects: await Project.countDocuments(matchQuery)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addToQueue,
  removeFromQueue,
  updateProgress,
  addMilestone,
  completeMilestone,
  getProjectStats
};

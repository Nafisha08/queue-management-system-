const Queue = require('../models/Queue');
const Project = require('../models/Project');
const User = require('../models/User');
const logger = require('../utils/logger');

class QueueService {
  /**
   * Create a new queue
   * @param {Object} queueData - Queue configuration data
   * @param {String} userId - ID of the user creating the queue
   * @returns {Promise<Queue>}
   */
  async createQueue(queueData, userId) {
    try {
      const queue = new Queue({
        ...queueData,
        createdBy: userId,
        permissions: {
          owners: [userId],
          ...queueData.permissions
        }
      });

      await queue.save();
      logger.info(`Queue created: ${queue.name} by user ${userId}`);
      return queue;
    } catch (error) {
      logger.error('Error creating queue:', error);
      throw error;
    }
  }

  /**
   * Get queue by ID with access control
   * @param {String} queueId - Queue ID
   * @param {String} userId - User ID requesting access
   * @returns {Promise<Queue|null>}
   */
  async getQueueById(queueId, userId) {
    try {
      const queue = await Queue.findOne({
        _id: queueId,
        archived: false,
        $or: [
          { createdBy: userId },
          { 'permissions.owners': userId },
          { 'permissions.managers': userId },
          { 'permissions.workers': userId },
          { 'permissions.viewers': userId }
        ]
      }).populate('permissions.owners permissions.managers permissions.workers permissions.viewers', 'username fullName email');

      return queue;
    } catch (error) {
      logger.error('Error fetching queue:', error);
      throw error;
    }
  }

  /**
   * Get all queues accessible to a user
   * @param {String} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getUserQueues(userId, filters = {}) {
    try {
      const query = {
        archived: false,
        $or: [
          { createdBy: userId },
          { 'permissions.owners': userId },
          { 'permissions.managers': userId },
          { 'permissions.workers': userId },
          { 'permissions.viewers': userId }
        ],
        ...filters
      };

      const queues = await Queue.find(query)
        .populate('createdBy', 'username fullName')
        .sort({ createdAt: -1 });

      return queues;
    } catch (error) {
      logger.error('Error fetching user queues:', error);
      throw error;
    }
  }

  /**
   * Update queue configuration
   * @param {String} queueId - Queue ID
   * @param {Object} updateData - Data to update
   * @param {String} userId - User ID making the update
   * @returns {Promise<Queue>}
   */
  async updateQueue(queueId, updateData, userId) {
    try {
      const queue = await this.getQueueById(queueId, userId);
      if (!queue) {
        throw new Error('Queue not found or access denied');
      }

      // Check if user has permission to modify
      const canModify = queue.createdBy.toString() === userId ||
                       queue.permissions.owners.includes(userId) ||
                       queue.permissions.managers.includes(userId);

      if (!canModify) {
        throw new Error('Insufficient permissions to modify queue');
      }

      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy') {
          queue[key] = updateData[key];
        }
      });

      await queue.save();
      logger.info(`Queue updated: ${queue.name} by user ${userId}`);
      return queue;
    } catch (error) {
      logger.error('Error updating queue:', error);
      throw error;
    }
  }

  /**
   * Add a project to a queue
   * @param {String} queueId - Queue ID
   * @param {String} projectId - Project ID
   * @param {String} userId - User ID making the request
   * @returns {Promise<Object>}
   */
  async addProjectToQueue(queueId, projectId, userId) {
    try {
      const queue = await Queue.findById(queueId);
      const project = await Project.findById(projectId);

      if (!queue || queue.archived) {
        throw new Error('Queue not found or archived');
      }

      if (!project || project.archived) {
        throw new Error('Project not found or archived');
      }

      // Check if project is already in a queue
      if (project.queueId) {
        throw new Error('Project is already in a queue');
      }

      // Check queue acceptance criteria
      const acceptanceCheck = queue.canAcceptProject(project);
      if (!acceptanceCheck.canAccept) {
        throw new Error(acceptanceCheck.reason);
      }

      // Add project to queue
      const position = await queue.addProject(project);

      // Auto-assign if configured
      if (queue.processingRules.autoAssign && !project.assignedTo) {
        await this.autoAssignProject(project, queue);
      }

      // Auto-start if configured and conditions are met
      if (queue.processingRules.autoStart && 
          queue.stats.processing < queue.concurrency) {
        await this.processNextProject(queueId);
      }

      logger.info(`Project ${project.name} added to queue ${queue.name} at position ${position}`);
      return { queue, project, position };
    } catch (error) {
      logger.error('Error adding project to queue:', error);
      throw error;
    }
  }

  /**
   * Remove a project from a queue
   * @param {String} queueId - Queue ID
   * @param {String} projectId - Project ID
   * @param {String} userId - User ID making the request
   * @returns {Promise<Object>}
   */
  async removeProjectFromQueue(queueId, projectId, userId) {
    try {
      const queue = await Queue.findById(queueId);
      const project = await Project.findById(projectId);

      if (!queue) {
        throw new Error('Queue not found');
      }

      if (!project) {
        throw new Error('Project not found');
      }

      if (project.queueId?.toString() !== queueId) {
        throw new Error('Project is not in this queue');
      }

      await queue.removeProject(project);

      logger.info(`Project ${project.name} removed from queue ${queue.name}`);
      return { queue, project };
    } catch (error) {
      logger.error('Error removing project from queue:', error);
      throw error;
    }
  }

  /**
   * Process the next project in queue
   * @param {String} queueId - Queue ID
   * @returns {Promise<Project|null>}
   */
  async processNextProject(queueId) {
    try {
      const queue = await Queue.findById(queueId);
      if (!queue || queue.status !== 'active') {
        return null;
      }

      if (queue.stats.processing >= queue.concurrency) {
        return null;
      }

      const nextProject = await queue.getNextProject();
      if (!nextProject) {
        return null;
      }

      // Start processing
      nextProject.status = 'in_progress';
      nextProject.startedAt = new Date();
      await nextProject.save();

      // Update queue stats
      queue.stats.processing += 1;
      queue.stats.lastProcessedAt = new Date();
      await queue.save();

      logger.info(`Started processing project: ${nextProject.name} in queue ${queue.name}`);
      return nextProject;
    } catch (error) {
      logger.error('Error processing next project:', error);
      throw error;
    }
  }

  /**
   * Auto-assign project to available worker
   * @param {Project} project - Project to assign
   * @param {Queue} queue - Queue containing the project
   * @returns {Promise<User|null>}
   */
  async autoAssignProject(project, queue) {
    try {
      // Find available workers with access to this queue
      const availableWorkers = await User.findAvailableWorkers(80)
        .where('_id').in([...queue.permissions.workers, ...queue.permissions.managers]);

      if (availableWorkers.length === 0) {
        return null;
      }

      // Simple assignment strategy: least loaded worker
      const worker = availableWorkers.reduce((prev, current) => {
        return prev.workloadPercentage < current.workloadPercentage ? prev : current;
      });

      project.assignedTo = worker._id;
      await project.save();

      // Update worker workload
      await worker.updateWorkload();

      logger.info(`Auto-assigned project ${project.name} to worker ${worker.username}`);
      return worker;
    } catch (error) {
      logger.error('Error auto-assigning project:', error);
      return null;
    }
  }

  /**
   * Get queue statistics
   * @param {String} queueId - Queue ID
   * @param {String} userId - User ID requesting stats
   * @returns {Promise<Object>}
   */
  async getQueueStats(queueId, userId) {
    try {
      const queue = await this.getQueueById(queueId, userId);
      if (!queue) {
        throw new Error('Queue not found or access denied');
      }

      // Update stats before returning
      await queue.updateStats();

      // Get additional metrics
      const projects = await Project.find({ queueId: queue._id });
      const overduePlants = projects.filter(p => 
        p.deadline && p.deadline < new Date() && 
        !['completed', 'cancelled', 'failed'].includes(p.status)
      );

      return {
        queue: {
          id: queue._id,
          name: queue.name,
          type: queue.type,
          status: queue.status,
          capacity: queue.capacity,
          concurrency: queue.concurrency
        },
        stats: queue.stats,
        metrics: {
          utilizationPercentage: queue.utilizationPercentage,
          availableSlots: queue.availableSlots,
          processingCapacity: queue.processingCapacity,
          overdueProjects: overduePlants.length,
          averageWaitTime: this.calculateAverageWaitTime(projects),
          throughput: this.calculateThroughput(projects)
        }
      };
    } catch (error) {
      logger.error('Error fetching queue stats:', error);
      throw error;
    }
  }

  /**
   * Calculate average wait time for projects in queue
   * @param {Array} projects - Array of projects
   * @returns {Number}
   */
  calculateAverageWaitTime(projects) {
    const queuedProjects = projects.filter(p => p.status === 'queued');
    if (queuedProjects.length === 0) return 0;

    const totalWaitTime = queuedProjects.reduce((total, project) => {
      return total + (new Date() - project.createdAt);
    }, 0);

    return totalWaitTime / queuedProjects.length;
  }

  /**
   * Calculate throughput (projects completed per day)
   * @param {Array} projects - Array of projects
   * @returns {Number}
   */
  calculateThroughput(projects) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyCompleted = projects.filter(p => 
      p.status === 'completed' && 
      p.completedAt && 
      p.completedAt >= thirtyDaysAgo
    );

    return recentlyCompleted.length / 30; // Projects per day
  }

  /**
   * Pause queue processing
   * @param {String} queueId - Queue ID
   * @param {String} userId - User ID making the request
   * @returns {Promise<Queue>}
   */
  async pauseQueue(queueId, userId) {
    try {
      const queue = await this.getQueueById(queueId, userId);
      if (!queue) {
        throw new Error('Queue not found or access denied');
      }

      queue.status = 'paused';
      await queue.save();

      logger.info(`Queue paused: ${queue.name} by user ${userId}`);
      return queue;
    } catch (error) {
      logger.error('Error pausing queue:', error);
      throw error;
    }
  }

  /**
   * Resume queue processing
   * @param {String} queueId - Queue ID
   * @param {String} userId - User ID making the request
   * @returns {Promise<Queue>}
   */
  async resumeQueue(queueId, userId) {
    try {
      const queue = await this.getQueueById(queueId, userId);
      if (!queue) {
        throw new Error('Queue not found or access denied');
      }

      queue.status = 'active';
      await queue.save();

      // Try to process queued projects
      while (queue.stats.processing < queue.concurrency) {
        const processed = await this.processNextProject(queueId);
        if (!processed) break;
      }

      logger.info(`Queue resumed: ${queue.name} by user ${userId}`);
      return queue;
    } catch (error) {
      logger.error('Error resuming queue:', error);
      throw error;
    }
  }

  /**
   * Archive a queue
   * @param {String} queueId - Queue ID
   * @param {String} userId - User ID making the request
   * @returns {Promise<Queue>}
   */
  async archiveQueue(queueId, userId) {
    try {
      const queue = await this.getQueueById(queueId, userId);
      if (!queue) {
        throw new Error('Queue not found or access denied');
      }

      // Check if user has permission to archive
      const canArchive = queue.createdBy.toString() === userId ||
                        queue.permissions.owners.includes(userId);

      if (!canArchive) {
        throw new Error('Insufficient permissions to archive queue');
      }

      // Move all queued projects back to pending
      await Project.updateMany(
        { queueId: queue._id, status: 'queued' },
        { 
          status: 'pending',
          queueId: null,
          queuePosition: null
        }
      );

      queue.archived = true;
      queue.archivedAt = new Date();
      queue.status = 'disabled';
      await queue.save();

      logger.info(`Queue archived: ${queue.name} by user ${userId}`);
      return queue;
    } catch (error) {
      logger.error('Error archiving queue:', error);
      throw error;
    }
  }

  /**
   * Reorder projects in queue
   * @param {String} queueId - Queue ID
   * @param {Array} projectOrder - Array of project IDs in desired order
   * @param {String} userId - User ID making the request
   * @returns {Promise<Array>}
   */
  async reorderQueue(queueId, projectOrder, userId) {
    try {
      const queue = await this.getQueueById(queueId, userId);
      if (!queue) {
        throw new Error('Queue not found or access denied');
      }

      // Check if user has permission to reorder
      const canReorder = queue.createdBy.toString() === userId ||
                        queue.permissions.owners.includes(userId) ||
                        queue.permissions.managers.includes(userId);

      if (!canReorder) {
        throw new Error('Insufficient permissions to reorder queue');
      }

      // Update project positions
      const updates = projectOrder.map((projectId, index) => ({
        updateOne: {
          filter: { _id: projectId, queueId: queue._id },
          update: { queuePosition: index + 1 }
        }
      }));

      await Project.bulkWrite(updates);

      logger.info(`Queue reordered: ${queue.name} by user ${userId}`);
      return projectOrder;
    } catch (error) {
      logger.error('Error reordering queue:', error);
      throw error;
    }
  }
}

module.exports = new QueueService();

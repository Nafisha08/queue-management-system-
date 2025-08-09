const cron = require('node-cron');
const Queue = require('../models/Queue');
const Project = require('../models/Project');
const User = require('../models/User');
const logger = require('../utils/logger');

class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the scheduler
   */
  async initializeScheduler() {
    if (this.initialized) {
      logger.info('Scheduler already initialized');
      return;
    }

    try {
      // Start core scheduled tasks
      await this.startCoreScheduledTasks();
      
      // Load and start user-defined queue schedules
      await this.loadQueueSchedules();
      
      this.initialized = true;
      logger.info('✅ Scheduler initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduler:', error);
      throw error;
    }
  }

  /**
   * Start core system scheduled tasks
   */
  async startCoreScheduledTasks() {
    // Update queue statistics every 5 minutes
    this.addTask('update-queue-stats', '*/5 * * * *', async () => {
      try {
        const activeQueues = await Queue.findActive();
        for (const queue of activeQueues) {
          await queue.updateStats();
        }
        logger.debug('Queue statistics updated');
      } catch (error) {
        logger.error('Error updating queue statistics:', error);
      }
    });

    // Update user workloads every 10 minutes
    this.addTask('update-user-workloads', '*/10 * * * *', async () => {
      try {
        const activeUsers = await User.find({ 
          status: 'active', 
          role: { $in: ['worker', 'manager'] } 
        });
        
        for (const user of activeUsers) {
          await user.updateWorkload();
        }
        logger.debug('User workloads updated');
      } catch (error) {
        logger.error('Error updating user workloads:', error);
      }
    });

    // Process queues every 2 minutes
    this.addTask('process-queues', '*/2 * * * *', async () => {
      try {
        await this.processAllQueues();
      } catch (error) {
        logger.error('Error processing queues:', error);
      }
    });

    // Clean up completed projects daily at 2 AM
    this.addTask('cleanup-projects', '0 2 * * *', async () => {
      try {
        const daysToKeep = parseInt(process.env.AUTO_ARCHIVE_COMPLETED_AFTER) || 30;
        const archiveDate = new Date();
        archiveDate.setDate(archiveDate.getDate() - daysToKeep);

        const result = await Project.updateMany(
          {
            status: { $in: ['completed', 'cancelled', 'failed'] },
            completedAt: { $lt: archiveDate },
            archived: false
          },
          {
            archived: true,
            archivedAt: new Date()
          }
        );

        logger.info(`Auto-archived ${result.modifiedCount} old completed projects`);
      } catch (error) {
        logger.error('Error during project cleanup:', error);
      }
    });

    // Send overdue notifications daily at 9 AM
    this.addTask('overdue-notifications', '0 9 * * *', async () => {
      try {
        await this.sendOverdueNotifications();
      } catch (error) {
        logger.error('Error sending overdue notifications:', error);
      }
    });

    // Update user statistics daily at 3 AM
    this.addTask('update-user-stats', '0 3 * * *', async () => {
      try {
        const users = await User.find({ archived: false });
        for (const user of users) {
          await user.updateStats();
        }
        logger.info('User statistics updated');
      } catch (error) {
        logger.error('Error updating user statistics:', error);
      }
    });

    logger.info('Core scheduled tasks started');
  }

  /**
   * Load and start user-defined queue schedules
   */
  async loadQueueSchedules() {
    try {
      const scheduledQueues = await Queue.find({
        'schedule.enabled': true,
        archived: false
      });

      for (const queue of scheduledQueues) {
        await this.addQueueSchedule(queue);
      }

      logger.info(`Loaded ${scheduledQueues.length} queue schedules`);
    } catch (error) {
      logger.error('Error loading queue schedules:', error);
    }
  }

  /**
   * Add a scheduled task
   * @param {string} name - Task name
   * @param {string} pattern - Cron pattern
   * @param {Function} task - Task function
   */
  addTask(name, pattern, task) {
    if (this.tasks.has(name)) {
      logger.warn(`Task ${name} already exists, skipping`);
      return;
    }

    try {
      const cronTask = cron.schedule(pattern, task, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.tasks.set(name, {
        cronTask,
        pattern,
        lastRun: null,
        nextRun: null
      });

      cronTask.start();
      logger.info(`✅ Scheduled task '${name}' with pattern '${pattern}'`);
    } catch (error) {
      logger.error(`Failed to schedule task '${name}':`, error);
    }
  }

  /**
   * Add or update a queue schedule
   * @param {Queue} queue - Queue object
   */
  async addQueueSchedule(queue) {
    const taskName = `queue-${queue._id}`;

    // Remove existing schedule if it exists
    if (this.tasks.has(taskName)) {
      this.removeTask(taskName);
    }

    if (!queue.schedule.enabled || !queue.schedule.pattern) {
      return;
    }

    try {
      const task = async () => {
        try {
          logger.info(`Running scheduled queue processing for: ${queue.name}`);
          
          // Update last run time
          queue.schedule.lastRun = new Date();
          
          // Process the queue
          const queueService = require('./queueService');
          let processed = 0;
          
          while (queue.stats.processing < queue.concurrency) {
            const project = await queueService.processNextProject(queue._id);
            if (!project) break;
            processed++;
          }

          // Calculate next run time
          queue.schedule.nextRun = this.getNextRunTime(queue.schedule.pattern);
          await queue.save();

          logger.info(`Scheduled processing completed for ${queue.name}: ${processed} projects processed`);
        } catch (error) {
          logger.error(`Error in scheduled queue processing for ${queue.name}:`, error);
        }
      };

      this.addTask(taskName, queue.schedule.pattern, task);
      
      // Update next run time
      queue.schedule.nextRun = this.getNextRunTime(queue.schedule.pattern);
      await queue.save();

    } catch (error) {
      logger.error(`Failed to add queue schedule for ${queue.name}:`, error);
    }
  }

  /**
   * Remove a scheduled task
   * @param {string} name - Task name
   */
  removeTask(name) {
    const task = this.tasks.get(name);
    if (task) {
      task.cronTask.stop();
      task.cronTask.destroy();
      this.tasks.delete(name);
      logger.info(`Removed scheduled task: ${name}`);
    }
  }

  /**
   * Process all active queues
   */
  async processAllQueues() {
    try {
      const activeQueues = await Queue.findActive();
      let totalProcessed = 0;

      for (const queue of activeQueues) {
        if (queue.stats.processing < queue.concurrency) {
          const queueService = require('./queueService');
          let processed = 0;
          
          // Try to process up to available concurrency
          const maxToProcess = queue.concurrency - queue.stats.processing;
          for (let i = 0; i < maxToProcess; i++) {
            const project = await queueService.processNextProject(queue._id);
            if (!project) break;
            processed++;
          }
          
          totalProcessed += processed;
          
          if (processed > 0) {
            logger.debug(`Processed ${processed} projects in queue: ${queue.name}`);
          }
        }
      }

      if (totalProcessed > 0) {
        logger.info(`Scheduler processed ${totalProcessed} projects across all queues`);
      }
    } catch (error) {
      logger.error('Error processing queues:', error);
    }
  }

  /**
   * Send notifications for overdue projects
   */
  async sendOverdueNotifications() {
    try {
      const overdueProjects = await Project.find({
        deadline: { $lt: new Date() },
        status: { $nin: ['completed', 'cancelled', 'failed'] },
        archived: false
      }).populate('assignedTo createdBy', 'email username fullName preferences');

      if (overdueProjects.length === 0) {
        logger.debug('No overdue projects found');
        return;
      }

      logger.info(`Found ${overdueProjects.length} overdue projects`);

      // Group by assigned user for batch notifications
      const userProjects = new Map();
      
      overdueProjects.forEach(project => {
        if (project.assignedTo) {
          const userId = project.assignedTo._id.toString();
          if (!userProjects.has(userId)) {
            userProjects.set(userId, {
              user: project.assignedTo,
              projects: []
            });
          }
          userProjects.get(userId).projects.push(project);
        }
      });

      // Send notifications to each user
      for (const [userId, data] of userProjects) {
        if (data.user.preferences?.notifications?.email?.projectDue) {
          // TODO: Implement email notification service
          logger.info(`Would send overdue notification to ${data.user.email} for ${data.projects.length} projects`);
        }
      }

    } catch (error) {
      logger.error('Error sending overdue notifications:', error);
    }
  }

  /**
   * Get next run time for a cron pattern
   * @param {string} pattern - Cron pattern
   * @returns {Date|null}
   */
  getNextRunTime(pattern) {
    try {
      const task = cron.schedule(pattern, () => {}, { scheduled: false });
      // This is a simplified implementation
      // In a real implementation, you'd use a proper cron parser
      const now = new Date();
      return new Date(now.getTime() + (60 * 60 * 1000)); // Add 1 hour as placeholder
    } catch (error) {
      logger.error('Error calculating next run time:', error);
      return null;
    }
  }

  /**
   * Get status of all scheduled tasks
   */
  getTaskStatus() {
    const status = [];
    
    for (const [name, task] of this.tasks) {
      status.push({
        name,
        pattern: task.pattern,
        lastRun: task.lastRun,
        nextRun: task.nextRun,
        isRunning: task.cronTask.running
      });
    }

    return status;
  }

  /**
   * Stop all scheduled tasks
   */
  async stopAll() {
    logger.info('Stopping all scheduled tasks...');
    
    for (const [name, task] of this.tasks) {
      task.cronTask.stop();
      task.cronTask.destroy();
    }
    
    this.tasks.clear();
    this.initialized = false;
    
    logger.info('All scheduled tasks stopped');
  }

  /**
   * Restart the scheduler
   */
  async restart() {
    await this.stopAll();
    await this.initializeScheduler();
  }
}

// Create singleton instance
const scheduler = new Scheduler();

module.exports = {
  initializeScheduler: () => scheduler.initializeScheduler(),
  addQueueSchedule: (queue) => scheduler.addQueueSchedule(queue),
  removeQueueSchedule: (queueId) => scheduler.removeTask(`queue-${queueId}`),
  getTaskStatus: () => scheduler.getTaskStatus(),
  stopAll: () => scheduler.stopAll(),
  restart: () => scheduler.restart(),
  scheduler
};

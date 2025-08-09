const express = require('express');
const queueService = require('../services/queueService');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { validateQueue } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @desc    Get all queues for current user
 * @route   GET /api/v1/queues
 * @access  Private
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (type) filters.type = type;
    
    const queues = await queueService.getUserQueues(req.user._id, filters);
    
    res.status(200).json({
      success: true,
      data: queues
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Create new queue
 * @route   POST /api/v1/queues
 * @access  Private (requires canCreateQueues permission)
 */
router.post('/', requirePermission('canCreateQueues'), validateQueue, async (req, res, next) => {
  try {
    const queue = await queueService.createQueue(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      data: queue
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get single queue
 * @route   GET /api/v1/queues/:id
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
  try {
    const queue = await queueService.getQueueById(req.params.id, req.user._id);
    
    if (!queue) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found or access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      data: queue
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Update queue
 * @route   PUT /api/v1/queues/:id
 * @access  Private
 */
router.put('/:id', validateQueue, async (req, res, next) => {
  try {
    const queue = await queueService.updateQueue(req.params.id, req.body, req.user._id);
    
    res.status(200).json({
      success: true,
      data: queue
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Get queue statistics
 * @route   GET /api/v1/queues/:id/stats
 * @access  Private
 */
router.get('/:id/stats', async (req, res, next) => {
  try {
    const stats = await queueService.getQueueStats(req.params.id, req.user._id);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Pause queue
 * @route   POST /api/v1/queues/:id/pause
 * @access  Private
 */
router.post('/:id/pause', async (req, res, next) => {
  try {
    const queue = await queueService.pauseQueue(req.params.id, req.user._id);
    
    res.status(200).json({
      success: true,
      data: queue,
      message: 'Queue paused'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Resume queue
 * @route   POST /api/v1/queues/:id/resume
 * @access  Private
 */
router.post('/:id/resume', async (req, res, next) => {
  try {
    const queue = await queueService.resumeQueue(req.params.id, req.user._id);
    
    res.status(200).json({
      success: true,
      data: queue,
      message: 'Queue resumed'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Process next project in queue
 * @route   POST /api/v1/queues/:id/process
 * @access  Private
 */
router.post('/:id/process', async (req, res, next) => {
  try {
    const project = await queueService.processNextProject(req.params.id);
    
    if (!project) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No projects available to process'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project,
      message: 'Project processing started'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Reorder queue
 * @route   PUT /api/v1/queues/:id/reorder
 * @access  Private
 */
router.put('/:id/reorder', async (req, res, next) => {
  try {
    const { projectOrder } = req.body;
    
    if (!Array.isArray(projectOrder)) {
      return res.status(400).json({
        success: false,
        error: 'projectOrder must be an array of project IDs'
      });
    }
    
    const result = await queueService.reorderQueue(req.params.id, projectOrder, req.user._id);
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Queue reordered successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Archive queue
 * @route   DELETE /api/v1/queues/:id
 * @access  Private
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const queue = await queueService.archiveQueue(req.params.id, req.user._id);
    
    res.status(200).json({
      success: true,
      data: queue,
      message: 'Queue archived successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

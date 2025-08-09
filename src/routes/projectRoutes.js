const express = require('express');
const {
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
} = require('../controllers/projectController');

const { protect, authorize } = require('../middleware/auth');
const { validateProject, validateProgress, validateMilestone } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Statistics route (before parameterized routes)
router.route('/stats')
  .get(getProjectStats);

// Main project routes
router.route('/')
  .get(getProjects)
  .post(validateProject, createProject);

router.route('/:id')
  .get(getProject)
  .put(validateProject, updateProject)
  .delete(authorize('admin', 'manager'), deleteProject);

// Queue management
router.route('/:id/queue')
  .post(addToQueue)
  .delete(removeFromQueue);

// Progress tracking
router.route('/:id/progress')
  .put(validateProgress, updateProgress);

// Milestone management
router.route('/:id/milestones')
  .post(validateMilestone, addMilestone);

router.route('/:id/milestones/:milestoneId/complete')
  .put(completeMilestone);

module.exports = router;

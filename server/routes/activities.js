const express = require('express');
const { body, validationResult } = require('express-validator');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { AppError, notFoundError } = require('../utils/errorHandler');
const NormalizationService = require('../services/normalizationService');

const router = express.Router();

/**
 * @route   POST /api/activities
 * @desc    Create a new activity
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  [
    body('type', 'Activity type is required').isIn([
      'running', 'cycling', 'swimming', 'gym', 'yoga', 'hiking', 'sports', 'other',
    ]),
    body('title', 'Title is required').notEmpty().trim(),
    body('startTime', 'Start time is required').isISO8601(),
    body('endTime', 'End time is required').isISO8601(),
    body('duration', 'Duration is required').isInt({ min: 1 }),
    body('intensity', 'Intensity must be light, moderate, or high')
      .optional()
      .isIn(['light', 'moderate', 'high']),
    body('distance').optional().isFloat({ min: 0 }),
    body('calories').optional().isInt({ min: 0 }),
    body('visibility', 'Visibility must be public, friends, or private')
      .optional()
      .isIn(['public', 'friends', 'private']),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      type, title, description, startTime, endTime, duration,
      distance, calories, intensity, visibility, location, photos,
    } = req.body;

    if (new Date(endTime) <= new Date(startTime)) {
      throw new AppError('End time must be after start time', 400);
    }

    const activity = new Activity({
      user: req.user._id,
      type,
      title,
      description,
      startTime,
      endTime,
      duration,
      distance,
      calories,
      intensity: intensity || 'moderate',
      visibility: visibility || 'public',
      location,
      photos,
    });

    await activity.save();

    const normalizedActivity = NormalizationService.normalizeActivity(activity);

    res.status(201).json(
      NormalizationService.normalizeSuccess(normalizedActivity, 'Activity created successfully'),
    );
  }),
);

/**
 * @route   GET /api/activities/feed
 * @desc    Get activity feed for authenticated user
 * @access  Private
 */
router.get(
  '/feed/all',
  authenticate,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const activities = await Activity.find({
      $or: [
        { user: req.user._id },
        { user: { $in: req.user.following }, visibility: 'public' },
      ],
    })
      .populate('user', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Activity.countDocuments({
      $or: [
        { user: req.user._id },
        { user: { $in: req.user.following }, visibility: 'public' },
      ],
    });

    const normalizedActivities = activities.map((activity) =>
      NormalizationService.normalizeActivity(activity),
    );

    const response = NormalizationService.normalizePagination(
      normalizedActivities,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'Feed retrieved successfully',
      ...response,
    });
  }),
);

/**
 * @route   GET /api/activities/:id
 * @desc    Get activity by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const activity = await Activity.findById(req.params.id)
      .populate('user', 'firstName lastName avatar')
      .populate('likes', 'firstName lastName avatar')
      .populate('comments.user', 'firstName lastName avatar');

    if (!activity) {
      throw notFoundError('Activity');
    }

    const normalizedActivity = NormalizationService.normalizeActivity(activity);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedActivity, 'Activity retrieved successfully'),
    );
  }),
);

/**
 * @route   PUT /api/activities/:id
 * @desc    Update activity
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('distance').optional().isFloat({ min: 0 }),
    body('calories').optional().isInt({ min: 0 }),
    body('intensity').optional().isIn(['light', 'moderate', 'high']),
    body('visibility').optional().isIn(['public', 'friends', 'private']),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      throw notFoundError('Activity');
    }

    if (activity.user.toString() !== req.user._id.toString()) {
      throw new AppError('You can only update your own activities', 403);
    }

    const allowedUpdates = ['title', 'description', 'distance', 'calories', 'intensity', 'visibility'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        activity[field] = req.body[field];
      }
    });

    await activity.save();

    const normalizedActivity = NormalizationService.normalizeActivity(activity);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedActivity, 'Activity updated successfully'),
    );
  }),
);

/**
 * @route   DELETE /api/activities/:id
 * @desc    Delete activity
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      throw notFoundError('Activity');
    }

    if (activity.user.toString() !== req.user._id.toString()) {
      throw new AppError('You can only delete your own activities', 403);
    }

    await Activity.findByIdAndDelete(req.params.id);

    res.status(200).json(
      NormalizationService.normalizeSuccess(null, 'Activity deleted successfully'),
    );
  }),
);

/**
 * @route   POST /api/activities/:id/like
 * @desc    Like an activity
 * @access  Private
 */
router.post(
  '/:id/like',
  authenticate,
  asyncHandler(async (req, res) => {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      throw notFoundError('Activity');
    }

    if (activity.likes.includes(req.user._id)) {
      throw new AppError('You have already liked this activity', 400);
    }

    activity.likes.push(req.user._id);
    await activity.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { likes: activity.likes.length },
        'Activity liked successfully',
      ),
    );
  }),
);

/**
 * @route   POST /api/activities/:id/unlike
 * @desc    Unlike an activity
 * @access  Private
 */
router.post(
  '/:id/unlike',
  authenticate,
  asyncHandler(async (req, res) => {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      throw notFoundError('Activity');
    }

    if (!activity.likes.includes(req.user._id)) {
      throw new AppError('You have not liked this activity', 400);
    }

    activity.likes = activity.likes.filter(
      (userId) => userId.toString() !== req.user._id.toString(),
    );
    await activity.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { likes: activity.likes.length },
        'Activity unliked successfully',
      ),
    );
  }),
);

/**
 * @route   POST /api/activities/:id/comment
 * @desc    Comment on activity
 * @access  Private
 */
router.post(
  '/:id/comment',
  authenticate,
  [
    body('text', 'Comment text is required').notEmpty().trim().isLength({ min: 1, max: 500 }),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      throw notFoundError('Activity');
    }

    const newComment = {
      user: req.user._id,
      text: req.body.text,
    };

    activity.comments.push(newComment);
    await activity.save();

    res.status(201).json(
      NormalizationService.normalizeSuccess(
        { comments: activity.comments.length },
        'Comment added successfully',
      ),
    );
  }),
);

/**
 * @route   GET /api/activities/user/:userId
 * @desc    Get activities by user
 * @access  Public
 */
router.get(
  '/user/:userId',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const activities = await Activity.find({
      user: req.params.userId,
      visibility: 'public',
    })
      .populate('user', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Activity.countDocuments({
      user: req.params.userId,
      visibility: 'public',
    });

    const normalizedActivities = activities.map((activity) =>
      NormalizationService.normalizeActivity(activity),
    );

    const response = NormalizationService.normalizePagination(
      normalizedActivities,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'User activities retrieved successfully',
      ...response,
    });
  }),
);

/**
 * @route   GET /api/activities/nearby/location
 * @desc    Get activities near a location
 * @access  Public
 */
router.get(
  '/nearby/location',
  asyncHandler(async (req, res) => {
    const { longitude, latitude, distance = 10 } = req.query;

    if (!longitude || !latitude) {
      throw new AppError('Longitude and latitude are required', 400);
    }

    const activities = await Activity.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseFloat(distance) * 1000,
        },
      },
      visibility: 'public',
    })
      .populate('user', 'firstName lastName avatar')
      .limit(50);

    const normalizedActivities = activities.map((activity) =>
      NormalizationService.normalizeActivity(activity),
    );

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        normalizedActivities,
        'Nearby activities retrieved successfully',
      ),
    );
  }),
);

module.exports = router;
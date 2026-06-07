const express = require('express');
const { body, validationResult } = require('express-validator');
const Workout = require('../models/Workout');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { AppError, notFoundError } = require('../utils/errorHandler');
const NormalizationService = require('../services/normalizationService');

const router = express.Router();

/**
 * @route   POST /api/workouts
 * @desc    Create a new workout
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  [
    body('title', 'Title is required').notEmpty().trim(),
    body('category', 'Category is required').isIn([
      'strength', 'cardio', 'flexibility', 'sports', 'recovery',
    ]),
    body('difficulty', 'Difficulty must be beginner, intermediate, or advanced')
      .optional()
      .isIn(['beginner', 'intermediate', 'advanced']),
    body('duration').optional().isInt({ min: 1 }),
    body('exercises').optional().isArray(),
    body('targetMuscles').optional().isArray(),
    body('equipment').optional().isArray(),
    body('isPublic').optional().isBoolean(),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      title, description, category, difficulty, duration,
      exercises, targetMuscles, equipment, isPublic,
    } = req.body;

    const workout = new Workout({
      creator: req.user._id,
      title,
      description,
      category,
      difficulty: difficulty || 'intermediate',
      duration,
      exercises: exercises || [],
      targetMuscles: targetMuscles || [],
      equipment: equipment || [],
      isPublic: isPublic !== undefined ? isPublic : true,
    });

    await workout.save();
    await workout.populate('creator', 'firstName lastName avatar');

    const normalizedWorkout = NormalizationService.normalizeWorkout(workout);

    res.status(201).json(
      NormalizationService.normalizeSuccess(normalizedWorkout, 'Workout created successfully'),
    );
  }),
);

/**
 * @route   GET /api/workouts
 * @desc    Get all public workouts with pagination
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      page = 1, limit = 10, category, difficulty, search,
    } = req.query;
    const skip = (page - 1) * limit;

    const query = { isPublic: true };

    if (category) {
      query.category = category;
    }
    if (difficulty) {
      query.difficulty = difficulty;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const workouts = await Workout.find(query)
      .populate('creator', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Workout.countDocuments(query);

    const normalizedWorkouts = workouts.map((workout) =>
      NormalizationService.normalizeWorkout(workout),
    );

    const response = NormalizationService.normalizePagination(
      normalizedWorkouts,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'Workouts retrieved successfully',
      ...response,
    });
  }),
);

/**
 * @route   GET /api/workouts/:id
 * @desc    Get workout by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id)
      .populate('creator', 'firstName lastName avatar')
      .populate('likes', 'firstName lastName')
      .populate('savedBy', 'firstName lastName')
      .populate('ratings.user', 'firstName lastName');

    if (!workout) {
      throw notFoundError('Workout');
    }

    const normalizedWorkout = NormalizationService.normalizeWorkout(workout);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedWorkout, 'Workout retrieved successfully'),
    );
  }),
);

/**
 * @route   PUT /api/workouts/:id
 * @desc    Update workout
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
    body('duration').optional().isInt({ min: 1 }),
    body('exercises').optional().isArray(),
    body('targetMuscles').optional().isArray(),
    body('equipment').optional().isArray(),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const workout = await Workout.findById(req.params.id);
    if (!workout) {
      throw notFoundError('Workout');
    }

    if (workout.creator.toString() !== req.user._id.toString()) {
      throw new AppError('You can only update your own workouts', 403);
    }

    const allowedUpdates = [
      'title', 'description', 'difficulty', 'duration', 'exercises',
      'targetMuscles', 'equipment',
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        workout[field] = req.body[field];
      }
    });

    await workout.save();
    await workout.populate('creator', 'firstName lastName avatar');

    const normalizedWorkout = NormalizationService.normalizeWorkout(workout);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedWorkout, 'Workout updated successfully'),
    );
  }),
);

/**
 * @route   DELETE /api/workouts/:id
 * @desc    Delete workout
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);
    if (!workout) {
      throw notFoundError('Workout');
    }

    if (workout.creator.toString() !== req.user._id.toString()) {
      throw new AppError('You can only delete your own workouts', 403);
    }

    await Workout.findByIdAndDelete(req.params.id);

    res.status(200).json(
      NormalizationService.normalizeSuccess(null, 'Workout deleted successfully'),
    );
  }),
);

/**
 * @route   POST /api/workouts/:id/like
 * @desc    Like a workout
 * @access  Private
 */
router.post(
  '/:id/like',
  authenticate,
  asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);
    if (!workout) {
      throw notFoundError('Workout');
    }

    if (workout.likes.includes(req.user._id)) {
      throw new AppError('You have already liked this workout', 400);
    }

    workout.likes.push(req.user._id);
    await workout.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { likes: workout.likes.length },
        'Workout liked successfully',
      ),
    );
  }),
);

/**
 * @route   POST /api/workouts/:id/unlike
 * @desc    Unlike a workout
 * @access  Private
 */
router.post(
  '/:id/unlike',
  authenticate,
  asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);
    if (!workout) {
      throw notFoundError('Workout');
    }

    if (!workout.likes.includes(req.user._id)) {
      throw new AppError('You have not liked this workout', 400);
    }

    workout.likes = workout.likes.filter(
      (userId) => userId.toString() !== req.user._id.toString(),
    );
    await workout.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { likes: workout.likes.length },
        'Workout unliked successfully',
      ),
    );
  }),
);

/**
 * @route   POST /api/workouts/:id/save
 * @desc    Save a workout
 * @access  Private
 */
router.post(
  '/:id/save',
  authenticate,
  asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);
    if (!workout) {
      throw notFoundError('Workout');
    }

    if (workout.savedBy.includes(req.user._id)) {
      throw new AppError('You have already saved this workout', 400);
    }

    workout.savedBy.push(req.user._id);
    await workout.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { saved: workout.savedBy.length },
        'Workout saved successfully',
      ),
    );
  }),
);

/**
 * @route   POST /api/workouts/:id/rate
 * @desc    Rate a workout
 * @access  Private
 */
router.post(
  '/:id/rate',
  authenticate,
  [
    body('rating', 'Rating must be between 1 and 5')
      .isInt({ min: 1, max: 5 }),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const workout = await Workout.findById(req.params.id);
    if (!workout) {
      throw notFoundError('Workout');
    }

    const existingRating = workout.ratings.findIndex(
      (r) => r.user.toString() === req.user._id.toString(),
    );

    if (existingRating >= 0) {
      workout.ratings[existingRating].rating = req.body.rating;
    } else {
      workout.ratings.push({
        user: req.user._id,
        rating: req.body.rating,
      });
    }

    await workout.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { averageRating: workout.averageRating, totalRatings: workout.ratings.length },
        'Workout rated successfully',
      ),
    );
  }),
);

/**
 * @route   GET /api/workouts/creator/:creatorId
 * @desc    Get workouts by creator
 * @access  Public
 */
router.get(
  '/creator/:creatorId',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const workouts = await Workout.find({
      creator: req.params.creatorId,
      isPublic: true,
    })
      .populate('creator', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Workout.countDocuments({
      creator: req.params.creatorId,
      isPublic: true,
    });

    const normalizedWorkouts = workouts.map((workout) =>
      NormalizationService.normalizeWorkout(workout),
    );

    const response = NormalizationService.normalizePagination(
      normalizedWorkouts,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'Creator workouts retrieved successfully',
      ...response,
    });
  }),
);

module.exports = router;
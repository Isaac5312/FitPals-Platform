const express = require('express');
const { body, validationResult } = require('express-validator');
const Challenge = require('../models/Challenge');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { AppError, notFoundError } = require('../utils/errorHandler');
const NormalizationService = require('../services/normalizationService');

const router = express.Router();

/**
 * @route   POST /api/challenges
 * @desc    Create a new challenge
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  [
    body('title', 'Title is required').notEmpty().trim(),
    body('type', 'Type is required').isIn(['distance', 'duration', 'count', 'calorie', 'streak']),
    body('category', 'Category is required').isIn([
      'running', 'cycling', 'swimming', 'gym', 'general',
    ]),
    body('goal.value', 'Goal value is required').isInt({ min: 1 }),
    body('goal.unit', 'Goal unit is required').notEmpty(),
    body('startDate', 'Start date is required').isISO8601(),
    body('endDate', 'End date is required').isISO8601(),
    body('maxParticipants').optional().isInt({ min: 1 }),
    body('isPublic').optional().isBoolean(),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      title, description, type, category, goal, startDate, endDate,
      maxParticipants, isPublic, prizes,
    } = req.body;

    if (new Date(endDate) <= new Date(startDate)) {
      throw new AppError('End date must be after start date', 400);
    }

    const challenge = new Challenge({
      title,
      description,
      creator: req.user._id,
      type,
      category,
      goal,
      startDate,
      endDate,
      maxParticipants,
      isPublic: isPublic !== undefined ? isPublic : true,
      prizes,
      participants: [{
        user: req.user._id,
        progress: { value: 0, percentage: 0 },
      }],
    });

    await challenge.save();
    await challenge.populate('creator', 'firstName lastName avatar');

    const normalizedChallenge = NormalizationService.normalizeChallenge(challenge);

    res.status(201).json(
      NormalizationService.normalizeSuccess(normalizedChallenge, 'Challenge created successfully'),
    );
  }),
);

/**
 * @route   GET /api/challenges
 * @desc    Get all public challenges
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      page = 1, limit = 10, category, type, status, search,
    } = req.query;
    const skip = (page - 1) * limit;

    const query = { isPublic: true };

    if (category) {
      query.category = category;
    }
    if (type) {
      query.type = type;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const challenges = await Challenge.find(query)
      .populate('creator', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Challenge.countDocuments(query);

    const normalizedChallenges = challenges.map((challenge) =>
      NormalizationService.normalizeChallenge(challenge),
    );

    const response = NormalizationService.normalizePagination(
      normalizedChallenges,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'Challenges retrieved successfully',
      ...response,
    });
  }),
);

/**
 * @route   GET /api/challenges/:id
 * @desc    Get challenge by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const challenge = await Challenge.findById(req.params.id)
      .populate('creator', 'firstName lastName avatar')
      .populate('participants.user', 'firstName lastName avatar')
      .populate('leaderboard.user', 'firstName lastName avatar');

    if (!challenge) {
      throw notFoundError('Challenge');
    }

    const normalizedChallenge = NormalizationService.normalizeChallenge(challenge);

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        normalizedChallenge,
        'Challenge retrieved successfully',
      ),
    );
  }),
);

/**
 * @route   PUT /api/challenges/:id
 * @desc    Update challenge
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  [
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim(),
    body('goal.value').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['upcoming', 'active', 'completed', 'cancelled']),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      throw notFoundError('Challenge');
    }

    if (challenge.creator.toString() !== req.user._id.toString()) {
      throw new AppError('You can only update your own challenges', 403);
    }

    const allowedUpdates = ['title', 'description', 'goal', 'status'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        challenge[field] = req.body[field];
      }
    });

    await challenge.save();
    await challenge.populate('creator', 'firstName lastName avatar');

    const normalizedChallenge = NormalizationService.normalizeChallenge(challenge);

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        normalizedChallenge,
        'Challenge updated successfully',
      ),
    );
  }),
);

/**
 * @route   DELETE /api/challenges/:id
 * @desc    Delete challenge
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      throw notFoundError('Challenge');
    }

    if (challenge.creator.toString() !== req.user._id.toString()) {
      throw new AppError('You can only delete your own challenges', 403);
    }

    await Challenge.findByIdAndDelete(req.params.id);

    res.status(200).json(
      NormalizationService.normalizeSuccess(null, 'Challenge deleted successfully'),
    );
  }),
);

/**
 * @route   POST /api/challenges/:id/join
 * @desc    Join a challenge
 * @access  Private
 */
router.post(
  '/:id/join',
  authenticate,
  asyncHandler(async (req, res) => {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      throw notFoundError('Challenge');
    }

    if (challenge.participants.some((p) => p.user.toString() === req.user._id.toString())) {
      throw new AppError('You are already participating in this challenge', 400);
    }

    if (challenge.maxParticipants && challenge.participants.length >= challenge.maxParticipants) {
      throw new AppError('Challenge has reached maximum participants', 400);
    }

    challenge.participants.push({
      user: req.user._id,
      progress: { value: 0, percentage: 0 },
    });

    await challenge.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { participants: challenge.participants.length },
        'Joined challenge successfully',
      ),
    );
  }),
);

/**
 * @route   POST /api/challenges/:id/leave
 * @desc    Leave a challenge
 * @access  Private
 */
router.post(
  '/:id/leave',
  authenticate,
  asyncHandler(async (req, res) => {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      throw notFoundError('Challenge');
    }

    const participantIndex = challenge.participants.findIndex(
      (p) => p.user.toString() === req.user._id.toString(),
    );

    if (participantIndex < 0) {
      throw new AppError('You are not participating in this challenge', 400);
    }

    challenge.participants.splice(participantIndex, 1);
    await challenge.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        { participants: challenge.participants.length },
        'Left challenge successfully',
      ),
    );
  }),
);

/**
 * @route   PUT /api/challenges/:id/progress
 * @desc    Update user progress in challenge
 * @access  Private
 */
router.put(
  '/:id/progress',
  authenticate,
  [
    body('value', 'Progress value is required').isInt({ min: 0 }),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      throw notFoundError('Challenge');
    }

    const participant = challenge.participants.find(
      (p) => p.user.toString() === req.user._id.toString(),
    );

    if (!participant) {
      throw new AppError('You are not participating in this challenge', 400);
    }

    participant.progress.value = req.body.value;
    participant.progress.percentage = Math.min(
      ((req.body.value / challenge.goal.value) * 100).toFixed(2),
      100,
    );

    await challenge.save();

    challenge.leaderboard = challenge.participants
      .sort((a, b) => b.progress.value - a.progress.value)
      .map((p, index) => ({
        user: p.user,
        rank: index + 1,
        progress: p.progress.value,
      }));

    await challenge.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        participant.progress,
        'Progress updated successfully',
      ),
    );
  }),
);

/**
 * @route   GET /api/challenges/:id/leaderboard
 * @desc    Get challenge leaderboard
 * @access  Public
 */
router.get(
  '/:id/leaderboard',
  asyncHandler(async (req, res) => {
    const challenge = await Challenge.findById(req.params.id).populate(
      'leaderboard.user',
      'firstName lastName avatar',
    );

    if (!challenge) {
      throw notFoundError('Challenge');
    }

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        challenge.leaderboard,
        'Leaderboard retrieved successfully',
      ),
    );
  }),
);

/**
 * @route   GET /api/challenges/user/:userId
 * @desc    Get user's challenges
 * @access  Public
 */
router.get(
  '/user/:userId',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const challenges = await Challenge.find({
      'participants.user': req.params.userId,
    })
      .populate('creator', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Challenge.countDocuments({
      'participants.user': req.params.userId,
    });

    const normalizedChallenges = challenges.map((challenge) =>
      NormalizationService.normalizeChallenge(challenge),
    );

    const response = NormalizationService.normalizePagination(
      normalizedChallenges,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'User challenges retrieved successfully',
      ...response,
    });
  }),
);

module.exports = router;
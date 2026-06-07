const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError, notFoundError } = require('../utils/errorHandler');
const NormalizationService = require('../services/normalizationService');

const router = express.Router();

/**
 * @route   GET /api/users/:id
 * @desc    Get user profile by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .populate('followers', 'firstName lastName avatar')
      .populate('following', 'firstName lastName avatar');

    if (!user) {
      throw notFoundError('User');
    }

    const normalizedUser = NormalizationService.normalizeUser(user);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedUser, 'User retrieved successfully'),
    );
  }),
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('phone').optional().matches(/^\+?[1-9]\d{1,14}$/);
    body('fitnessLevel').optional().isIn(['beginner', 'intermediate', 'advanced']),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      throw new AppError('You can only update your own profile', 403);
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      throw notFoundError('User');
    }

    const allowedUpdates = ['firstName', 'lastName', 'bio', 'phone', 'fitnessLevel', 'avatar'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    const normalizedUser = NormalizationService.normalizeUser(user);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedUser, 'Profile updated successfully'),
    );
  }),
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res, next) => {
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      throw new AppError('You can only delete your own account', 403);
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      throw notFoundError('User');
    }

    res.status(200).json(
      NormalizationService.normalizeSuccess(null, 'Account deleted successfully'),
    );
  }),
);

/**
 * @route   POST /api/users/:id/follow
 * @desc    Follow a user
 * @access  Private
 */
router.post(
  '/:id/follow',
  authenticate,
  asyncHandler(async (req, res, next) => {
    if (req.user._id.toString() === req.params.id) {
      throw new AppError('You cannot follow yourself', 400);
    }

    const userToFollow = await User.findById(req.params.id);
    if (!userToFollow) {
      throw notFoundError('User');
    }

    if (req.user.following.includes(req.params.id)) {
      throw new AppError('Already following this user', 400);
    }

    req.user.following.push(req.params.id);
    await req.user.save();

    userToFollow.followers.push(req.user._id);
    await userToFollow.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(null, 'User followed successfully'),
    );
  }),
);

/**
 * @route   POST /api/users/:id/unfollow
 * @desc    Unfollow a user
 * @access  Private
 */
router.post(
  '/:id/unfollow',
  authenticate,
  asyncHandler(async (req, res, next) => {
    const userToUnfollow = await User.findById(req.params.id);
    if (!userToUnfollow) {
      throw notFoundError('User');
    }

    if (!req.user.following.includes(req.params.id)) {
      throw new AppError('Not following this user', 400);
    }

    req.user.following = req.user.following.filter(
      (id) => id.toString() !== req.params.id,
    );
    await req.user.save();

    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== req.user._id.toString(),
    );
    await userToUnfollow.save();

    res.status(200).json(
      NormalizationService.normalizeSuccess(null, 'User unfollowed successfully'),
    );
  }),
);

/**
 * @route   GET /api/users/:id/followers
 * @desc    Get user's followers
 * @access  Public
 */
router.get(
  '/:id/followers',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).populate(
      'followers',
      'firstName lastName avatar fitnessLevel',
    );

    if (!user) {
      throw notFoundError('User');
    }

    const normalizedFollowers = user.followers.map((follower) =>
      NormalizationService.normalizeUser(follower),
    );

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        normalizedFollowers,
        'Followers retrieved successfully',
      ),
    );
  }),
);

/**
 * @route   GET /api/users/:id/following
 * @desc    Get users that user is following
 * @access  Public
 */
router.get(
  '/:id/following',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).populate(
      'following',
      'firstName lastName avatar fitnessLevel',
    );

    if (!user) {
      throw notFoundError('User');
    }

    const normalizedFollowing = user.following.map((followUser) =>
      NormalizationService.normalizeUser(followUser),
    );

    res.status(200).json(
      NormalizationService.normalizeSuccess(
        normalizedFollowing,
        'Following retrieved successfully',
      ),
    );
  }),
);

/**
 * @route   GET /api/users/search/query
 * @desc    Search users by name or email
 * @access  Public
 */
router.get(
  '/search/query',
  asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      throw new AppError('Search query is required', 400);
    }

    const skip = (page - 1) * limit;

    const users = await User.find({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    })
      .select('firstName lastName avatar fitnessLevel')
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await User.countDocuments({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    });

    const normalizedUsers = users.map((user) =>
      NormalizationService.normalizeUser(user),
    );

    const response = NormalizationService.normalizePagination(
      normalizedUsers,
      page,
      limit,
      total,
    );

    res.status(200).json({
      success: true,
      message: 'Users found',
      ...response,
    });
  }),
);

/**
 * @route   PUT /api/users/:id/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put(
  '/:id/preferences',
  authenticate,
  [
    body('fitnessGoals').optional().isArray(),
    body('interests').optional().isArray(),
    body('notifications.email').optional().isBoolean(),
    body('notifications.push').optional().isBoolean(),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      throw new AppError('You can only update your own preferences', 403);
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      throw notFoundError('User');
    }

    if (req.body.fitnessGoals) {
      user.preferences.fitnessGoals = req.body.fitnessGoals;
    }
    if (req.body.interests) {
      user.preferences.interests = req.body.interests;
    }
    if (req.body.notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...req.body.notifications,
      };
    }

    await user.save();

    const normalizedUser = NormalizationService.normalizeUser(user);

    res.status(200).json(
      NormalizationService.normalizeSuccess(normalizedUser, 'Preferences updated successfully'),
    );
  }),
);

module.exports = router;
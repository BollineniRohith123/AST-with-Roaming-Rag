/**
 * Repository API routes
 */
const express = require('express');
const repositoryController = require('../controllers/repositoryController');
const { validate, schemas } = require('../../middleware/validator');
const { createRepositoryRateLimiter, createChatRateLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/repositories
 * @desc    Get all repositories
 * @access  Public
 */
router.get('/', repositoryController.getAllRepositories);

/**
 * @route   GET /api/repositories/:id
 * @desc    Get repository by ID
 * @access  Public
 */
router.get(
  '/:id',
  validate(schemas.repository.getById),
  repositoryController.getRepositoryById
);

/**
 * @route   POST /api/repositories
 * @desc    Create a new repository
 * @access  Public
 */
router.post(
  '/',
  createRepositoryRateLimiter(),
  validate(schemas.repository.create),
  repositoryController.createRepository
);

/**
 * @route   GET /api/repositories/:repoId/files
 * @desc    Get repository files
 * @access  Public
 */
router.get(
  '/:repoId/files',
  validate(schemas.file.getByRepo),
  repositoryController.getRepositoryFiles
);

/**
 * @route   GET /api/repositories/:repoId/dataflow
 * @desc    Get repository data flow
 * @access  Public
 */
router.get(
  '/:repoId/dataflow',
  validate(schemas.repository.getById, 'params'),
  repositoryController.getRepositoryDataFlow
);

/**
 * @route   GET /api/repositories/:repoId/search
 * @desc    Search repository code
 * @access  Public
 */
router.get(
  '/:repoId/search',
  validate(schemas.search.query),
  repositoryController.searchRepositoryCode
);

/**
 * @route   POST /api/repositories/:repoId/chat
 * @desc    Chat with repository codebase
 * @access  Public
 */
router.post(
  '/:repoId/chat',
  createChatRateLimiter(),
  validate(schemas.chat.query),
  repositoryController.chatWithCodebase
);

/**
 * @route   DELETE /api/repositories/:id
 * @desc    Delete repository
 * @access  Public
 */
router.delete(
  '/:id',
  validate(schemas.repository.getById, 'params'),
  repositoryController.deleteRepository
);

module.exports = router;
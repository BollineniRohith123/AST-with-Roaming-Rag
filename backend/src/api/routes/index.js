/**
 * API Routes
 */
const express = require('express');
const repositoryRoutes = require('./repositoryRoutes');
const fileRoutes = require('./fileRoutes');
const classRoutes = require('./classRoutes');
const methodRoutes = require('./methodRoutes');
const healthRoutes = require('./healthRoutes');

const router = express.Router();

// Route definitions
router.use('/repositories', repositoryRoutes);
router.use('/files', fileRoutes);
router.use('/classes', classRoutes);
router.use('/methods', methodRoutes);
router.use('/health', healthRoutes);

module.exports = router;
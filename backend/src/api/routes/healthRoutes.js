/**
 * Health Check Routes
 */
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Basic health check
router.get('/', healthController.getHealth);

// Detailed health check
router.get('/details', healthController.getDetailedHealth);

module.exports = router;
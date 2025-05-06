/**
 * API server setup
 */
const express = require('express');
const cors = require('cors');
require('express-async-errors'); // Error handling for async routes
const logger = require('../utils/logger');
const routes = require('./routes');
const {
  helmetConfig,
  xssProtection,
  hppProtection,
  responseCompression,
  addCorsHeaders,
  checkContentType,
  secureDownloadHeaders
} = require('../middleware/security');
const { errorHandler, handleUndefinedRoutes } = require('../middleware/errorHandler');
const { createDefaultRateLimiter } = require('../middleware/rateLimiter');

// Initialize express app
const app = express();

// Apply security middleware
app.use(helmetConfig);
app.use(xssProtection);
app.use(hppProtection);
app.use(responseCompression);
app.use(addCorsHeaders);

// Apply rate limiting
app.use(createDefaultRateLimiter());

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(checkContentType);
app.use(secureDownloadHeaders);

// Request logging
app.use(logger.requestLogger);

// Health check endpoint (no rate limiting)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    version: require('../../package.json').version,
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  });
});

// API routes
app.use('/api', routes);

// Handle 404 routes
app.use(handleUndefinedRoutes);

// Global error handler
app.use(errorHandler);

// Export app
module.exports = app;
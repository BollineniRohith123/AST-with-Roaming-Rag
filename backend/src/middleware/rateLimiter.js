/**
 * Rate limiting middleware for API endpoints
 */
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create default rate limiter for general API endpoints
 */
const createDefaultRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      error: 'Too many requests, please try again later.',
      status: 429
    },
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      res.status(options.statusCode).json(options.message);
    },
    skip: (req) => {
      // Skip rate limiting for health check endpoint
      return req.path === '/api/health';
    },
    keyGenerator: (req) => {
      // Use IP address as the key, with X-Forwarded-For header support
      return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    }
  });
};

/**
 * Create stricter rate limiter for auth endpoints
 */
const createAuthRateLimiter = () => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 failed attempts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many failed login attempts, please try again after an hour',
      status: 429
    },
    handler: (req, res, next, options) => {
      logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      res.status(options.statusCode).json(options.message);
    }
  });
};

/**
 * Create rate limiter for repository analysis endpoints
 */
const createRepositoryRateLimiter = () => {
  return rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5, // 5 repository analysis requests per 30 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many repository analysis requests, please try again later',
      status: 429
    },
    handler: (req, res, next, options) => {
      logger.warn(`Repository analysis rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      res.status(options.statusCode).json(options.message);
    }
  });
};

/**
 * Create rate limiter for chat endpoints
 */
const createChatRateLimiter = () => {
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 chat requests per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many chat requests, please try again in a few minutes',
      status: 429
    },
    handler: (req, res, next, options) => {
      logger.warn(`Chat rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent']
      });
      res.status(options.statusCode).json(options.message);
    }
  });
};

module.exports = {
  createDefaultRateLimiter,
  createAuthRateLimiter,
  createRepositoryRateLimiter,
  createChatRateLimiter
};
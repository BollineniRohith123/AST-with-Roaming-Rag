/**
 * Security middleware for hardening the API server
 */
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const { ApiError } = require('./errorHandler');

/**
 * Configure helmet security headers
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
});

/**
 * Configure XSS protection
 */
const xssProtection = xss();

/**
 * Configure HPP (HTTP Parameter Pollution) protection
 */
const hppProtection = hpp();

/**
 * Configure response compression
 */
const responseCompression = compression();

/**
 * Add CORS headers middleware
 */
const addCorsHeaders = (req, res, next) => {
  // Get allowed origins from environment or use default
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:8001'];
  
  const origin = req.headers.origin;
  
  // Check if the request origin is in our allowed list
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // For development, allow any origin
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

/**
 * Check content type for POST/PUT requests
 */
const checkContentType = (req, res, next) => {
  if (['POST', 'PUT'].includes(req.method) && req.body && 
     !req.is('application/json') && Object.keys(req.body).length > 0) {
    return next(new ApiError('Content-Type must be application/json', 415));
  }
  next();
};

/**
 * Add security headers for download responses
 */
const secureDownloadHeaders = (req, res, next) => {
  res.on('header', () => {
    // For file downloads, set content-disposition headers
    if (req.path.includes('/download') || req.path.includes('/export')) {
      const filename = req.query.filename || 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  });
  next();
};

module.exports = {
  helmetConfig,
  xssProtection,
  hppProtection,
  responseCompression,
  addCorsHeaders,
  checkContentType,
  secureDownloadHeaders,
};
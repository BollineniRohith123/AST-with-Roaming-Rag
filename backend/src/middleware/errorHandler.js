/**
 * Global error handling middleware
 */
const logger = require('../utils/logger');

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Indicates if error is operational (expected) vs programming
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create a specific API error for 404 Not Found
 */
const notFoundError = (resource) => {
  return new ApiError(`${resource || 'Resource'} not found`, 404);
};

/**
 * Create a specific API error for 400 Bad Request
 */
const badRequestError = (message, details) => {
  return new ApiError(message || 'Bad request', 400, details);
};

/**
 * Create a specific API error for 401 Unauthorized
 */
const unauthorizedError = (message) => {
  return new ApiError(message || 'Unauthorized', 401);
};

/**
 * Create a specific API error for 403 Forbidden
 */
const forbiddenError = (message) => {
  return new ApiError(message || 'Forbidden', 403);
};

/**
 * Create a specific API error for 500 Internal Server Error
 */
const serverError = (message, details) => {
  return new ApiError(message || 'Internal server error', 500, details);
};

/**
 * Format the error response
 */
const formatError = (err) => {
  // Base error response
  const errorResponse = {
    error: err.message || 'Something went wrong',
    status: err.statusCode || 500,
  };
  
  // Add details if available
  if (err.details && Object.keys(err.details).length > 0) {
    errorResponse.details = err.details;
  }
  
  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  return errorResponse;
};

/**
 * Handle 404 errors for undefined routes
 */
const handleUndefinedRoutes = (req, res, next) => {
  const error = notFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;
  
  // If err is not an ApiError, convert it
  if (!(error instanceof ApiError)) {
    // Handle specific error types
    if (error.name === 'ValidationError') {
      // Joi or Mongoose validation error
      error = badRequestError('Validation Error', { details: error.details || error.message });
    } else if (error.name === 'CastError') {
      // Mongoose cast error
      error = badRequestError('Invalid ID format');
    } else if (error.code === 11000) {
      // MongoDB duplicate key error
      error = badRequestError('Duplicate field value', { field: Object.keys(error.keyValue)[0] });
    } else if (error.name === 'JsonWebTokenError') {
      // JWT errors
      error = unauthorizedError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      // JWT expiration error
      error = unauthorizedError('Token expired');
    } else {
      // Generic server error for unhandled errors
      const statusCode = error.statusCode || 500;
      const message = statusCode === 500 ? 'Internal server error' : error.message;
      error = new ApiError(message, statusCode, { originalError: error.message });
    }
  }
  
  // Log the error
  if (error.statusCode >= 500) {
    logger.error('Server error:', {
      message: error.message,
      stack: error.stack,
      details: error.details,
      path: req.path,
      method: req.method,
    });
  } else {
    // Client errors (4xx) are just warnings
    logger.warn('Client error:', {
      message: error.message,
      details: error.details,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
    });
  }
  
  // Format and send the error response
  const errorResponse = formatError(error);
  
  res.status(error.statusCode || 500).json(errorResponse);
};

module.exports = {
  ApiError,
  notFoundError,
  badRequestError,
  unauthorizedError,
  forbiddenError,
  serverError,
  handleUndefinedRoutes,
  errorHandler,
};
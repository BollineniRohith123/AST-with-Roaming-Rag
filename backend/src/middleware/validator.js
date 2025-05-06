/**
 * Request validation middleware using Joi
 */
const Joi = require('joi');
const { badRequestError } = require('./errorHandler');

/**
 * Create a validation middleware using the provided schema
 * 
 * @param {Object} schema - Joi validation schema with keys for 'params', 'query', 'body'
 * @param {string} type - The request property to validate ('params', 'query', 'body', or 'all')
 * @returns {Function} Express middleware function
 */
const validate = (schema, type = 'all') => {
  return (req, res, next) => {
    try {
      // Default options for Joi validation
      const options = {
        abortEarly: false, // Include all errors
        allowUnknown: true, // Ignore unknown props
        stripUnknown: true // Remove unknown props
      };

      let error;
      let validationResult;

      // Validate based on the type or all
      if (type === 'params' || type === 'all') {
        if (schema.params) {
          validationResult = schema.params.validate(req.params, options);
          if (validationResult.error) error = validationResult.error;
          else req.params = validationResult.value;
        }
      }

      if ((type === 'query' || type === 'all') && !error) {
        if (schema.query) {
          validationResult = schema.query.validate(req.query, options);
          if (validationResult.error) error = validationResult.error;
          else req.query = validationResult.value;
        }
      }

      if ((type === 'body' || type === 'all') && !error) {
        if (schema.body) {
          validationResult = schema.body.validate(req.body, options);
          if (validationResult.error) error = validationResult.error;
          else req.body = validationResult.value;
        }
      }

      // If there's an error, return a bad request
      if (error) {
        // Format the error details for a cleaner response
        const details = error.details.map(detail => ({
          message: detail.message.replace(/['"]/g, ''),
          path: detail.path,
          type: detail.type
        }));

        return next(badRequestError('Validation Error', { details }));
      }

      // No errors, continue
      return next();
    } catch (err) {
      // If there's an unexpected error in the validation itself
      return next(badRequestError('Validation failed', { error: err.message }));
    }
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // Repository validation
  repository: {
    create: {
      body: Joi.object({
        url: Joi.string().uri().required().messages({
          'string.uri': 'Repository URL must be a valid URL',
          'any.required': 'Repository URL is required'
        })
      })
    },
    getById: {
      params: Joi.object({
        id: Joi.number().integer().required().messages({
          'number.base': 'Repository ID must be a number',
          'any.required': 'Repository ID is required'
        })
      })
    }
  },
  
  // File validation
  file: {
    getByRepo: {
      params: Joi.object({
        repoId: Joi.number().integer().required().messages({
          'number.base': 'Repository ID must be a number',
          'any.required': 'Repository ID is required'
        })
      })
    },
    getById: {
      params: Joi.object({
        id: Joi.number().integer().required().messages({
          'number.base': 'File ID must be a number',
          'any.required': 'File ID is required'
        })
      })
    }
  },
  
  // Class validation
  class: {
    getByFile: {
      params: Joi.object({
        fileId: Joi.number().integer().required().messages({
          'number.base': 'File ID must be a number',
          'any.required': 'File ID is required'
        })
      })
    },
    getById: {
      params: Joi.object({
        id: Joi.number().integer().required().messages({
          'number.base': 'Class ID must be a number',
          'any.required': 'Class ID is required'
        })
      })
    }
  },
  
  // Method validation
  method: {
    getByClass: {
      params: Joi.object({
        classId: Joi.number().integer().required().messages({
          'number.base': 'Class ID must be a number',
          'any.required': 'Class ID is required'
        })
      })
    },
    getById: {
      params: Joi.object({
        id: Joi.number().integer().required().messages({
          'number.base': 'Method ID must be a number',
          'any.required': 'Method ID is required'
        })
      })
    }
  },
  
  // Search validation
  search: {
    query: {
      params: Joi.object({
        repoId: Joi.number().integer().required().messages({
          'number.base': 'Repository ID must be a number',
          'any.required': 'Repository ID is required'
        })
      }),
      query: Joi.object({
        q: Joi.string().required().min(2).messages({
          'string.min': 'Search query must be at least 2 characters',
          'any.required': 'Search query is required'
        })
      })
    }
  },
  
  // Chat validation
  chat: {
    query: {
      params: Joi.object({
        repoId: Joi.number().integer().required().messages({
          'number.base': 'Repository ID must be a number',
          'any.required': 'Repository ID is required'
        })
      }),
      body: Joi.object({
        query: Joi.string().required().min(5).max(500).messages({
          'string.min': 'Chat query must be at least 5 characters',
          'string.max': 'Chat query cannot exceed 500 characters',
          'any.required': 'Chat query is required'
        })
      })
    }
  }
};

module.exports = {
  validate,
  schemas
};
/**
 * Method Routes
 */
const express = require('express');
const router = express.Router();
const methodController = require('../controllers/methodController');
const { validate, idParamSchema } = require('../../middleware/validator');

// Get a method by ID
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  methodController.getMethod
);

// Get method calls
router.get(
  '/:id/calls',
  validate(idParamSchema, 'params'),
  methodController.getMethodCalls
);

// Get variables in a method
router.get(
  '/:id/variables',
  validate(idParamSchema, 'params'),
  methodController.getVariables
);

module.exports = router;
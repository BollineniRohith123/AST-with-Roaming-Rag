/**
 * Class Routes
 */
const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { validate, idParamSchema } = require('../../middleware/validator');

// Get a class by ID
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  classController.getClass
);

// Get methods in a class
router.get(
  '/:id/methods',
  validate(idParamSchema, 'params'),
  classController.getMethods
);

// Get fields in a class
router.get(
  '/:id/fields',
  validate(idParamSchema, 'params'),
  classController.getFields
);

module.exports = router;
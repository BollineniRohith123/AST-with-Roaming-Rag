/**
 * File Routes
 */
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { validate, idParamSchema } = require('../../middleware/validator');

// Get classes in a file
router.get(
  '/:id/classes',
  validate(idParamSchema, 'params'),
  fileController.getClasses
);

// Get file content
router.get(
  '/:id/content',
  validate(idParamSchema, 'params'),
  fileController.getFileContent
);

// Get Spark sources in a file
router.get(
  '/:id/sources',
  validate(idParamSchema, 'params'),
  fileController.getSparkSources
);

// Get Spark transformations in a file
router.get(
  '/:id/transformations',
  validate(idParamSchema, 'params'),
  fileController.getSparkTransformations
);

// Get Spark sinks in a file
router.get(
  '/:id/sinks',
  validate(idParamSchema, 'params'),
  fileController.getSparkSinks
);

module.exports = router;
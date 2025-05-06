/**
 * File Controller
 * Handles file-related operations
 */
const db = require('../../db');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Get classes in a file
 */
exports.getClasses = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify file exists
    const fileExists = await checkFileExists(id);
    if (!fileExists) {
      return next(new AppError('File not found', 404));
    }
    
    const classes = await db.getClassesByFileId(id);
    res.json(classes);
  } catch (error) {
    logger.error(`Error fetching classes for file ${id}:`, error);
    next(error);
  }
};

/**
 * Get Spark sources in a file
 */
exports.getSparkSources = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify file exists
    const fileExists = await checkFileExists(id);
    if (!fileExists) {
      return next(new AppError('File not found', 404));
    }
    
    const sources = await db.getSparkSourcesByFileId(id);
    res.json(sources);
  } catch (error) {
    logger.error(`Error fetching Spark sources for file ${id}:`, error);
    next(error);
  }
};

/**
 * Get Spark transformations in a file
 */
exports.getSparkTransformations = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify file exists
    const fileExists = await checkFileExists(id);
    if (!fileExists) {
      return next(new AppError('File not found', 404));
    }
    
    const transformations = await db.getSparkTransformationsByFileId(id);
    res.json(transformations);
  } catch (error) {
    logger.error(`Error fetching Spark transformations for file ${id}:`, error);
    next(error);
  }
};

/**
 * Get Spark sinks in a file
 */
exports.getSparkSinks = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify file exists
    const fileExists = await checkFileExists(id);
    if (!fileExists) {
      return next(new AppError('File not found', 404));
    }
    
    const sinks = await db.getSparkSinksByFileId(id);
    res.json(sinks);
  } catch (error) {
    logger.error(`Error fetching Spark sinks for file ${id}:`, error);
    next(error);
  }
};

/**
 * Get file content
 */
exports.getFileContent = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify file exists
    const file = await getFile(id);
    if (!file) {
      return next(new AppError('File not found', 404));
    }
    
    // Read file content
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(file.path)) {
      return next(new AppError('File not found on disk', 404, 'The file exists in the database but could not be found on disk.'));
    }
    
    const content = fs.readFileSync(file.path, 'utf8');
    res.json({
      id: file.id,
      name: file.name,
      path: file.path,
      content
    });
  } catch (error) {
    logger.error(`Error fetching file content for file ${id}:`, error);
    next(error);
  }
};

/**
 * Check if a file exists
 */
async function checkFileExists(fileId) {
  try {
    const result = await db.pool.query(
      'SELECT EXISTS(SELECT 1 FROM files WHERE id = $1)',
      [fileId]
    );
    return result.rows[0].exists;
  } catch (error) {
    logger.error(`Error checking if file ${fileId} exists:`, error);
    throw error;
  }
}

/**
 * Get a file by ID
 */
async function getFile(fileId) {
  try {
    const result = await db.pool.query(
      'SELECT * FROM files WHERE id = $1',
      [fileId]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching file ${fileId}:`, error);
    throw error;
  }
}
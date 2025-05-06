/**
 * Class Controller
 * Handles class-related operations
 */
const db = require('../../db');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Get methods in a class
 */
exports.getMethods = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify class exists
    const classExists = await checkClassExists(id);
    if (!classExists) {
      return next(new AppError('Class not found', 404));
    }
    
    const methods = await db.getMethodsByClassId(id);
    res.json(methods);
  } catch (error) {
    logger.error(`Error fetching methods for class ${id}:`, error);
    next(error);
  }
};

/**
 * Get fields in a class
 */
exports.getFields = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify class exists
    const classExists = await checkClassExists(id);
    if (!classExists) {
      return next(new AppError('Class not found', 404));
    }
    
    const fields = await db.getFieldsByClassId(id);
    res.json(fields);
  } catch (error) {
    logger.error(`Error fetching fields for class ${id}:`, error);
    next(error);
  }
};

/**
 * Get class details
 */
exports.getClass = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    const classInfo = await getClassById(id);
    if (!classInfo) {
      return next(new AppError('Class not found', 404));
    }
    
    // Get file information
    const fileInfo = await getFileById(classInfo.file_id);
    
    // Get methods and fields
    const methods = await db.getMethodsByClassId(id);
    const fields = await db.getFieldsByClassId(id);
    
    res.json({
      ...classInfo,
      file: fileInfo ? {
        id: fileInfo.id,
        name: fileInfo.name,
        path: fileInfo.path,
        package_name: fileInfo.package_name
      } : null,
      methods,
      fields
    });
  } catch (error) {
    logger.error(`Error fetching class details for class ${id}:`, error);
    next(error);
  }
};

/**
 * Check if a class exists
 */
async function checkClassExists(classId) {
  try {
    const result = await db.pool.query(
      'SELECT EXISTS(SELECT 1 FROM classes WHERE id = $1)',
      [classId]
    );
    return result.rows[0].exists;
  } catch (error) {
    logger.error(`Error checking if class ${classId} exists:`, error);
    throw error;
  }
}

/**
 * Get a class by ID
 */
async function getClassById(classId) {
  try {
    const result = await db.pool.query(
      'SELECT * FROM classes WHERE id = $1',
      [classId]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching class ${classId}:`, error);
    throw error;
  }
}

/**
 * Get a file by ID
 */
async function getFileById(fileId) {
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
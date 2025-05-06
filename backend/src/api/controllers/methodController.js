/**
 * Method Controller
 * Handles method-related operations
 */
const db = require('../../db');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Get a method by ID
 */
exports.getMethod = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    const method = await getMethodById(id);
    if (!method) {
      return next(new AppError('Method not found', 404));
    }
    
    // Get class information
    const classInfo = await getClassById(method.class_id);
    
    // Get method calls and variables
    const methodCalls = await getMethodCalls(id);
    const variables = await getVariables(id);
    
    res.json({
      ...method,
      class: classInfo ? {
        id: classInfo.id,
        name: classInfo.name,
        is_interface: classInfo.is_interface
      } : null,
      calls: methodCalls,
      variables
    });
  } catch (error) {
    logger.error(`Error fetching method details for method ${id}:`, error);
    next(error);
  }
};

/**
 * Get method calls
 */
exports.getMethodCalls = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify method exists
    const methodExists = await checkMethodExists(id);
    if (!methodExists) {
      return next(new AppError('Method not found', 404));
    }
    
    const methodCalls = await getMethodCalls(id);
    res.json(methodCalls);
  } catch (error) {
    logger.error(`Error fetching method calls for method ${id}:`, error);
    next(error);
  }
};

/**
 * Get variables in a method
 */
exports.getVariables = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Verify method exists
    const methodExists = await checkMethodExists(id);
    if (!methodExists) {
      return next(new AppError('Method not found', 404));
    }
    
    const variables = await getVariables(id);
    res.json(variables);
  } catch (error) {
    logger.error(`Error fetching variables for method ${id}:`, error);
    next(error);
  }
};

/**
 * Check if a method exists
 */
async function checkMethodExists(methodId) {
  try {
    const result = await db.pool.query(
      'SELECT EXISTS(SELECT 1 FROM methods WHERE id = $1)',
      [methodId]
    );
    return result.rows[0].exists;
  } catch (error) {
    logger.error(`Error checking if method ${methodId} exists:`, error);
    throw error;
  }
}

/**
 * Get a method by ID
 */
async function getMethodById(methodId) {
  try {
    const result = await db.pool.query(
      'SELECT * FROM methods WHERE id = $1',
      [methodId]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching method ${methodId}:`, error);
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
 * Get method calls for a method
 */
async function getMethodCalls(methodId) {
  try {
    const result = await db.pool.query(
      'SELECT * FROM method_calls WHERE method_id = $1 ORDER BY id',
      [methodId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Error fetching method calls for method ${methodId}:`, error);
    throw error;
  }
}

/**
 * Get variables for a method
 */
async function getVariables(methodId) {
  try {
    const result = await db.pool.query(
      'SELECT * FROM variables WHERE method_id = $1 ORDER BY id',
      [methodId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Error fetching variables for method ${methodId}:`, error);
    throw error;
  }
}
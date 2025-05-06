const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create a PostgreSQL connection pool
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'ast_analysis',
  password: process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.PGPORT || '5432'),
});

/**
 * Initialize the database schema
 */
async function initDatabase() {
  try {
    const client = await pool.connect();
    try {
      // Read the schema SQL file
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute the schema SQL
      await client.query(schemaSql);
      console.log('Database schema initialized successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  }
}

/**
 * Store a repository in the database
 */
async function storeRepository(url, name, clonePath) {
  const query = {
    text: 'INSERT INTO repositories(url, name, clone_path) VALUES($1, $2, $3) RETURNING id',
    values: [url, name, clonePath],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store a file in the database
 */
async function storeFile(repoId, name, path, packageName) {
  const query = {
    text: 'INSERT INTO files(repo_id, name, path, package_name) VALUES($1, $2, $3, $4) RETURNING id',
    values: [repoId, name, path, packageName],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store a class in the database
 */
async function storeClass(fileId, name, isInterface, extendsClass, implementsInterfaces) {
  const query = {
    text: 'INSERT INTO classes(file_id, name, is_interface, extends_class, implements_interfaces) VALUES($1, $2, $3, $4, $5) RETURNING id',
    values: [fileId, name, isInterface, extendsClass, implementsInterfaces],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store a method in the database
 */
async function storeMethod(classId, name, returnType, isPublic, isStatic, parameters, body) {
  const query = {
    text: 'INSERT INTO methods(class_id, name, return_type, is_public, is_static, parameters, body) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    values: [classId, name, returnType, isPublic, isStatic, JSON.stringify(parameters), body],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store a field in the database
 */
async function storeField(classId, name, type, isPublic, isStatic, initialValue) {
  const query = {
    text: 'INSERT INTO fields(class_id, name, type, is_public, is_static, initial_value) VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
    values: [classId, name, type, isPublic, isStatic, initialValue],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store method calls in the database
 */
async function storeMethodCalls(methodId, methodCalls) {
  if (!methodCalls || methodCalls.length === 0) {
    return [];
  }
  
  const values = methodCalls.map(call => `(${methodId}, '${call}')`).join(',');
  const query = {
    text: `INSERT INTO method_calls(method_id, name) VALUES ${values} RETURNING id`,
  };
  
  const result = await pool.query(query);
  return result.rows.map(row => row.id);
}

/**
 * Store variables in the database
 */
async function storeVariables(methodId, variables) {
  if (!variables || variables.length === 0) {
    return [];
  }
  
  const valueParams = [];
  const valueArgs = [];
  let paramIndex = 1;
  
  for (const variable of variables) {
    valueParams.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
    valueArgs.push(methodId, variable.name, variable.type, variable.initialValue);
    paramIndex += 4;
  }
  
  const query = {
    text: `INSERT INTO variables(method_id, name, type, initial_value) VALUES ${valueParams.join(',')} RETURNING id`,
    values: valueArgs,
  };
  
  const result = await pool.query(query);
  return result.rows.map(row => row.id);
}

/**
 * Store Spark source information
 */
async function storeSparkSource(fileId, type, args, variableName) {
  const query = {
    text: 'INSERT INTO spark_sources(file_id, type, arguments, variable_name) VALUES($1, $2, $3, $4) RETURNING id',
    values: [fileId, type, args, variableName],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store Spark transformation information
 */
async function storeSparkTransformation(fileId, type, args, dataframeName) {
  const query = {
    text: 'INSERT INTO spark_transformations(file_id, type, arguments, dataframe_name) VALUES($1, $2, $3, $4) RETURNING id',
    values: [fileId, type, JSON.stringify(args), dataframeName],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Store Spark sink information
 */
async function storeSparkSink(fileId, type, args, dataframeName) {
  const query = {
    text: 'INSERT INTO spark_sinks(file_id, type, arguments, dataframe_name) VALUES($1, $2, $3, $4) RETURNING id',
    values: [fileId, type, JSON.stringify(args), dataframeName],
  };
  
  const result = await pool.query(query);
  return result.rows[0].id;
}

/**
 * Get all repositories
 */
async function getRepositories() {
  const query = {
    text: 'SELECT * FROM repositories ORDER BY created_at DESC',
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get a repository by ID
 */
async function getRepositoryById(id) {
  const query = {
    text: 'SELECT * FROM repositories WHERE id = $1',
    values: [id],
  };
  
  const result = await pool.query(query);
  return result.rows[0];
}

/**
 * Get files in a repository
 */
async function getFilesByRepositoryId(repoId) {
  const query = {
    text: 'SELECT * FROM files WHERE repo_id = $1',
    values: [repoId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get classes in a file
 */
async function getClassesByFileId(fileId) {
  const query = {
    text: 'SELECT * FROM classes WHERE file_id = $1',
    values: [fileId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get methods in a class
 */
async function getMethodsByClassId(classId) {
  const query = {
    text: 'SELECT * FROM methods WHERE class_id = $1',
    values: [classId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get fields in a class
 */
async function getFieldsByClassId(classId) {
  const query = {
    text: 'SELECT * FROM fields WHERE class_id = $1',
    values: [classId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get Spark sources in a file
 */
async function getSparkSourcesByFileId(fileId) {
  const query = {
    text: 'SELECT * FROM spark_sources WHERE file_id = $1',
    values: [fileId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get Spark transformations in a file
 */
async function getSparkTransformationsByFileId(fileId) {
  const query = {
    text: 'SELECT * FROM spark_transformations WHERE file_id = $1',
    values: [fileId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get Spark sinks in a file
 */
async function getSparkSinksByFileId(fileId) {
  const query = {
    text: 'SELECT * FROM spark_sinks WHERE file_id = $1',
    values: [fileId],
  };
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get the data flow for visualization
 */
async function getDataFlow(repoId) {
  // Get all Spark sources, transformations, and sinks
  const sourcesQuery = {
    text: `
      SELECT s.*, f.name as file_name 
      FROM spark_sources s 
      JOIN files f ON s.file_id = f.id 
      WHERE f.repo_id = $1
    `,
    values: [repoId],
  };
  
  const transformationsQuery = {
    text: `
      SELECT t.*, f.name as file_name 
      FROM spark_transformations t 
      JOIN files f ON t.file_id = f.id 
      WHERE f.repo_id = $1
    `,
    values: [repoId],
  };
  
  const sinksQuery = {
    text: `
      SELECT s.*, f.name as file_name 
      FROM spark_sinks s 
      JOIN files f ON s.file_id = f.id 
      WHERE f.repo_id = $1
    `,
    values: [repoId],
  };
  
  const sources = (await pool.query(sourcesQuery)).rows;
  const transformations = (await pool.query(transformationsQuery)).rows;
  const sinks = (await pool.query(sinksQuery)).rows;
  
  return {
    sources,
    transformations,
    sinks,
  };
}

/**
 * Search for code
 */
async function searchCode(repoId, query) {
  // Search in methods
  const methodsQuery = {
    text: `
      SELECT m.id, m.name, m.body, c.name as class_name, f.name as file_name
      FROM methods m
      JOIN classes c ON m.class_id = c.id
      JOIN files f ON c.file_id = f.id
      WHERE f.repo_id = $1 AND (
        m.name ILIKE $2 OR
        m.body ILIKE $2
      )
    `,
    values: [repoId, `%${query}%`],
  };
  
  // Search in classes
  const classesQuery = {
    text: `
      SELECT c.id, c.name, f.name as file_name
      FROM classes c
      JOIN files f ON c.file_id = f.id
      WHERE f.repo_id = $1 AND c.name ILIKE $2
    `,
    values: [repoId, `%${query}%`],
  };
  
  // Search in files
  const filesQuery = {
    text: `
      SELECT id, name, path
      FROM files
      WHERE repo_id = $1 AND (
        name ILIKE $2 OR
        path ILIKE $2
      )
    `,
    values: [repoId, `%${query}%`],
  };
  
  const methods = (await pool.query(methodsQuery)).rows;
  const classes = (await pool.query(classesQuery)).rows;
  const files = (await pool.query(filesQuery)).rows;
  
  return {
    methods,
    classes,
    files,
  };
}

module.exports = {
  initDatabase,
  // Repository operations
  storeRepository,
  getRepositories,
  getRepositoryById,
  // File operations
  storeFile,
  getFilesByRepositoryId,
  // Class operations
  storeClass,
  getClassesByFileId,
  // Method operations
  storeMethod,
  getMethodsByClassId,
  // Field operations
  storeField,
  getFieldsByClassId,
  // Helper operations
  storeMethodCalls,
  storeVariables,
  // Spark operations
  storeSparkSource,
  storeSparkTransformation,
  storeSparkSink,
  getSparkSourcesByFileId,
  getSparkTransformationsByFileId,
  getSparkSinksByFileId,
  // Flow operations
  getDataFlow,
  // Search operations
  searchCode,
  // Pool for direct access if needed
  pool,
};
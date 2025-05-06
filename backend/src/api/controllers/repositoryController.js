/**
 * Repository controller for managing code repositories
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../../db');
const { RoamingRagSystem } = require('../../rag');
const logger = require('../../utils/logger');
const { 
  ApiError,
  notFoundError, 
  badRequestError,
  serverError
} = require('../../middleware/errorHandler');

/**
 * Get all repositories
 */
const getAllRepositories = async (req, res, next) => {
  try {
    const repositories = await db.getAllRepositories();
    res.json(repositories);
  } catch (error) {
    logger.error('Error getting repositories:', error);
    next(serverError('Failed to retrieve repositories'));
  }
};

/**
 * Get repository by ID
 */
const getRepositoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const repository = await db.getRepositoryById(id);
    
    if (!repository) {
      return next(notFoundError('Repository not found'));
    }
    
    // Enhancement: Add file count to repository details
    const fileCount = await db.getFileCountByRepositoryId(id);
    const enhancedRepository = {
      ...repository,
      fileCount
    };
    
    res.json(enhancedRepository);
  } catch (error) {
    logger.error(`Error getting repository ${req.params.id}:`, error);
    next(serverError('Failed to retrieve repository'));
  }
};

/**
 * Create a new repository
 */
const createRepository = async (req, res, next) => {
  try {
    const { url } = req.body;
    
    // Check if URL is valid
    if (!url || !url.trim()) {
      return next(badRequestError('Repository URL is required'));
    }
    
    // Check if URL is a valid git repository
    if (!url.match(/^https?:\/\/[^\s/$.?#].[^\s]*$/i) || 
        !url.includes('github.com') && !url.includes('gitlab.com') && !url.includes('bitbucket.org')) {
      return next(badRequestError('Invalid repository URL. Only GitHub, GitLab, and BitBucket URLs are supported.'));
    }
    
    // Extract repository name from URL
    const urlParts = url.split('/');
    const repoName = urlParts[urlParts.length - 1].replace('.git', '') || 
                     urlParts[urlParts.length - 2];
    
    // Generate unique path for the repository
    const reposDir = path.join(__dirname, '../../../repos');
    const clonePath = path.join(reposDir, `${repoName}-${Date.now()}`);
    
    // Create repository record
    const repository = await db.createRepository(url, repoName, clonePath);
    
    // Start cloning and processing asynchronously
    processRepository(repository);
    
    res.status(201).json(repository);
  } catch (error) {
    logger.error('Error creating repository:', error);
    next(serverError('Failed to create repository'));
  }
};

/**
 * Clone and process a repository asynchronously
 */
const processRepository = async (repository) => {
  try {
    logger.info(`Starting to process repository: ${repository.name} (${repository.id})`);
    
    // Clone the repository
    await cloneRepository(repository.url, repository.clone_path);
    
    // Process Java files
    await processJavaFiles(repository.id, repository.clone_path);
    
    // Update repository status to processed
    await db.updateRepositoryStatus(repository.id, 'processed');
    
    logger.info(`Repository processed successfully: ${repository.name} (${repository.id})`);
  } catch (error) {
    logger.error(`Error processing repository ${repository.id}:`, error);
    
    // Update repository status to error
    try {
      await db.updateRepositoryStatus(repository.id, 'error', error.message);
    } catch (updateError) {
      logger.error(`Failed to update repository status for ${repository.id}:`, updateError);
    }
  }
};

/**
 * Clone a git repository
 */
const cloneRepository = (url, clonePath) => {
  return new Promise((resolve, reject) => {
    logger.info(`Cloning repository from ${url} to ${clonePath}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(clonePath))) {
      fs.mkdirSync(path.dirname(clonePath), { recursive: true });
    }
    
    // Use git clone command
    const gitProcess = spawn('git', ['clone', url, clonePath]);
    
    let errorOutput = '';
    
    gitProcess.stderr.on('data', (data) => {
      const message = data.toString();
      // Git sends progress info to stderr, so we need to check if it's an actual error
      if (!message.includes('Cloning into') && !message.includes('Receiving objects')) {
        errorOutput += message;
      }
    });
    
    gitProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Git clone failed with code ${code}: ${errorOutput}`));
      }
      logger.info(`Repository cloned successfully to ${clonePath}`);
      resolve();
    });
  });
};

/**
 * Process Java files using the Java parser
 */
const processJavaFiles = (repositoryId, clonePath) => {
  return new Promise((resolve, reject) => {
    logger.info(`Processing Java files for repository ${repositoryId}`);
    
    // Path to Java parser jar
    const jarPath = findJavaParserJar();
    
    if (!jarPath) {
      return reject(new Error('Java parser JAR not found'));
    }
    
    // Spawn Java process to parse the files
    const javaProcess = spawn('java', [
      '-jar', 
      jarPath, 
      '--repo-id', 
      repositoryId.toString(), 
      '--repo-path', 
      clonePath,
      '--db-host',
      process.env.PGHOST || 'localhost',
      '--db-port',
      process.env.PGPORT || '5432',
      '--db-name',
      process.env.PGDATABASE || 'ast_analysis',
      '--db-user',
      process.env.PGUSER || 'postgres',
      '--db-password',
      process.env.PGPASSWORD || 'postgres'
    ]);
    
    let errorOutput = '';
    
    javaProcess.stdout.on('data', (data) => {
      logger.debug(`Java parser output: ${data}`);
    });
    
    javaProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      logger.error(`Java parser error: ${data}`);
    });
    
    javaProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Java parser failed with code ${code}: ${errorOutput}`));
      }
      logger.info(`Java files processed successfully for repository ${repositoryId}`);
      resolve();
    });
  });
};

/**
 * Find the Java parser JAR file
 */
const findJavaParserJar = () => {
  const libDir = path.join(__dirname, '../../../lib');
  
  if (!fs.existsSync(libDir)) {
    logger.error('Lib directory not found');
    return null;
  }
  
  const files = fs.readdirSync(libDir);
  const jarFile = files.find(file => file.includes('java-parser') && file.endsWith('.jar'));
  
  if (!jarFile) {
    logger.error('Java parser JAR not found in lib directory');
    return null;
  }
  
  return path.join(libDir, jarFile);
};

/**
 * Get repository files
 */
const getRepositoryFiles = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const repository = await db.getRepositoryById(repoId);
    
    if (!repository) {
      return next(notFoundError('Repository not found'));
    }
    
    const files = await db.getFilesByRepositoryId(repoId);
    res.json(files);
  } catch (error) {
    logger.error(`Error getting files for repository ${req.params.repoId}:`, error);
    next(serverError('Failed to retrieve repository files'));
  }
};

/**
 * Get repository data flow
 */
const getRepositoryDataFlow = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const repository = await db.getRepositoryById(repoId);
    
    if (!repository) {
      return next(notFoundError('Repository not found'));
    }
    
    // Get Spark sources, transformations, and sinks
    const sources = await db.getSparkSourcesByRepositoryId(repoId);
    const transformations = await db.getSparkTransformationsByRepositoryId(repoId);
    const sinks = await db.getSparkSinksByRepositoryId(repoId);
    
    res.json({
      sources,
      transformations,
      sinks
    });
  } catch (error) {
    logger.error(`Error getting data flow for repository ${req.params.repoId}:`, error);
    next(serverError('Failed to retrieve repository data flow'));
  }
};

/**
 * Search repository code
 */
const searchRepositoryCode = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return next(badRequestError('Search query must be at least 2 characters'));
    }
    
    const repository = await db.getRepositoryById(repoId);
    
    if (!repository) {
      return next(notFoundError('Repository not found'));
    }
    
    const results = await db.searchCode(repoId, q);
    res.json(results);
  } catch (error) {
    logger.error(`Error searching code for repository ${req.params.repoId}:`, error);
    next(serverError('Failed to search repository code'));
  }
};

/**
 * Chat with repository codebase
 */
const chatWithCodebase = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const { query } = req.body;
    
    if (!query || query.trim().length < 5) {
      return next(badRequestError('Chat query must be at least 5 characters'));
    }
    
    const repository = await db.getRepositoryById(repoId);
    
    if (!repository) {
      return next(notFoundError('Repository not found'));
    }
    
    // Check if repository has been processed
    if (repository.status !== 'processed') {
      return next(badRequestError('Repository analysis is not complete yet'));
    }
    
    // Initialize RAG system if it doesn't exist yet
    let ragSystem = req.app.get(`rag-${repoId}`);
    
    if (!ragSystem) {
      logger.info(`Initializing RAG system for repository ${repoId}`);
      ragSystem = new RoamingRagSystem(repoId, repository.clone_path);
      await ragSystem.initialize();
      req.app.set(`rag-${repoId}`, ragSystem);
    }
    
    // Process query and return response
    const response = await ragSystem.queryCodebase(query);
    res.json({ response });
  } catch (error) {
    logger.error(`Error chatting with repository ${req.params.repoId}:`, error);
    next(serverError('Failed to process chat query'));
  }
};

/**
 * Delete repository
 */
const deleteRepository = async (req, res, next) => {
  try {
    const { id } = req.params;
    const repository = await db.getRepositoryById(id);
    
    if (!repository) {
      return next(notFoundError('Repository not found'));
    }
    
    // Delete repository from database (cascade delete should handle related records)
    await db.deleteRepository(id);
    
    // Clean up repository directory
    if (fs.existsSync(repository.clone_path)) {
      fs.rmSync(repository.clone_path, { recursive: true, force: true });
    }
    
    // Clean up RAG system if it exists
    if (req.app.get(`rag-${id}`)) {
      req.app.set(`rag-${id}`, null);
    }
    
    res.status(204).end();
  } catch (error) {
    logger.error(`Error deleting repository ${req.params.id}:`, error);
    next(serverError('Failed to delete repository'));
  }
};

module.exports = {
  getAllRepositories,
  getRepositoryById,
  createRepository,
  getRepositoryFiles,
  getRepositoryDataFlow,
  searchRepositoryCode,
  chatWithCodebase,
  deleteRepository
};
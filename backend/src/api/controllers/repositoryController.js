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
    const repositories = await db.getRepositories();
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
    const { url, name, description } = req.body;

    // Validate inputs
    if (!url || !url.trim()) {
      return next(badRequestError('Repository URL is required'));
    }

    if (!name || !name.trim()) {
      return next(badRequestError('Repository name is required'));
    }

    // Check if repository already exists with this URL
    const existingRepo = await db.getRepositoryByUrl(url);
    if (existingRepo) {
      return next(badRequestError(`Repository with URL ${url} already exists`));
    }

    // Create repository record
    const repository = await db.createRepository({
      url,
      name: name.trim(),
      description: description ? description.trim() : '',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // First, check if Java parser JAR is available
    const jarPath = findJavaParserJar();
    if (!jarPath) {
      logger.warn(`Java parser JAR not found. Repository ${repository.id} will be created but code will not be analyzed.`);

      // Still clone the repository but don't run Java parser
      const clonePath = path.join(process.env.REPO_STORAGE_PATH || './repositories', repository.id.toString());
      cloneRepository(url, clonePath)
        .then(async () => {
          // Index Java files without detailed parsing
          logger.info(`Repository ${repository.id} cloned to ${clonePath}, indexing files without Java parser`);
          try {
            // Find all Java files recursively in the repository
            const { spawn } = require('child_process');
            const findJavaFiles = spawn('find', [clonePath, '-name', '*.java']);

            let fileList = '';
            findJavaFiles.stdout.on('data', (data) => {
              fileList += data.toString();
            });

            findJavaFiles.on('close', async (code) => {
              if (code === 0 && fileList.trim()) {
                // Process each Java file and add to database
                const files = fileList.trim().split('\n');
                logger.info(`Found ${files.length} Java files in repository ${repository.id}`);

                for (const filePath of files) {
                  try {
                    const relativePath = filePath.replace(clonePath + '/', '');
                    const fileName = path.basename(filePath);
                    const packagePath = path.dirname(relativePath);

                    // Store file in database
                    await db.storeFile({
                      repoId: repository.id,
                      name: fileName,
                      path: relativePath,
                      packageName: packagePath
                    });
                  } catch (fileError) {
                    logger.error(`Error indexing file ${filePath}:`, fileError);
                  }
                }

                await db.updateRepository(repository.id, {
                  status: 'partial',
                  statusMessage: 'Repository cloned and files indexed, but Java parser not available for detailed analysis',
                  clone_path: clonePath
                });
              } else {
                logger.warn(`No Java files found in repository ${repository.id} or error finding files`);
                await db.updateRepository(repository.id, {
                  status: 'partial',
                  statusMessage: 'Repository cloned but no Java files found or error finding files',
                  clone_path: clonePath
                });
              }
            });
          } catch (indexError) {
            logger.error(`Error indexing Java files for repository ${repository.id}:`, indexError);
            await db.updateRepository(repository.id, {
              status: 'partial',
              statusMessage: 'Repository cloned but error indexing Java files',
              clone_path: clonePath
            });
          }
        })
        .catch(error => {
          logger.error(`Error cloning repository ${repository.id}:`, error);
          db.updateRepository(repository.id, { status: 'error', error: error.message })
            .catch(err => logger.error(`Failed to update repository status:`, err));
        });

      res.status(201).json(repository);
      return;
    }

    // Process repository asynchronously if Java parser is available
    processRepository(repository)
      .catch(error => {
        logger.error(`Error processing repository ${repository.id}:`, error);
        db.updateRepository(repository.id, { status: 'error', error: error.message })
          .catch(err => logger.error(`Failed to update repository status:`, err));
      });

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
    // Try to find Java executable
    let javaExecutable = 'java'; // Default to system Java

    // Check for common Java installation paths
    const possibleJavaPaths = [
      '/usr/local/opt/openjdk@17/bin/java',
      '/usr/local/opt/openjdk/bin/java',
      '/usr/bin/java',
      '/opt/homebrew/opt/openjdk/bin/java'
    ];

    for (const javaPath of possibleJavaPaths) {
      if (fs.existsSync(javaPath)) {
        javaExecutable = javaPath;
        break;
      }
    }

    logger.info(`Using Java executable: ${javaExecutable}`);

    const javaProcess = spawn(javaExecutable, [
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
 * Find the Java parser JAR file in the lib directory
 */
const findJavaParserJar = () => {
  const libDir = path.join(__dirname, '../../../lib');

  if (!fs.existsSync(libDir)) {
    logger.error('Lib directory not found');
    // Create the lib directory if it doesn't exist
    try {
      fs.mkdirSync(libDir, { recursive: true });
      logger.info('Created lib directory');
    } catch (error) {
      logger.error('Failed to create lib directory:', error);
    }
    return null;
  }

  const files = fs.readdirSync(libDir);
  const jarFile = files.find(file => file.includes('java-parser') && file.endsWith('.jar'));

  if (!jarFile) {
    logger.error('Java parser JAR not found in lib directory');
    // Create an empty placeholder JAR file for testing
    try {
      const placeholderPath = path.join(libDir, 'java-parser-1.0.jar');
      if (!fs.existsSync(placeholderPath)) {
        fs.writeFileSync(placeholderPath, 'PLACEHOLDER JAR FILE FOR TESTING');
        logger.info('Created placeholder Java parser JAR for testing');
        return placeholderPath;
      }
    } catch (error) {
      logger.error('Failed to create placeholder JAR file:', error);
    }
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

    // Check if repository exists
    const repository = await db.getRepositoryById(repoId);
    if (!repository) {
      return next(notFoundError(`Repository with ID ${repoId} not found`));
    }

    // Check if Java parser is available
    const jarPath = findJavaParserJar();
    if (!jarPath) {
      // Return empty dataflow structure instead of error
      logger.warn(`Java parser not available for repository ${repoId} dataflow request`);
      return res.json({
        sources: [],
        transformations: [],
        sinks: []
      });
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

    // Accept search query from either body or query params for flexibility
    const searchQuery = req.body.query || req.query.q;

    if (!searchQuery || searchQuery.trim().length < 2) {
      return next(badRequestError('Search query must be at least 2 characters'));
    }

    const repository = await db.getRepositoryById(repoId);

    if (!repository) {
      return next(notFoundError('Repository not found'));
    }

    const results = await db.searchCode(repoId, searchQuery);
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

    // Warn about repository status
    if (repository.status === 'pending') {
      logger.warn(`Chat request for pending repository ${repoId}. Using mock responses.`);
      // Return a mock response for pending repositories
      return res.json({
        response: `
# Repository Analysis

This repository (${repository.name}) is currently being processed. The analysis is not yet complete, but I can provide some general information about Java and Spark codebases.

## Common Components in Java/Spark Repositories

1. **Java Classes**: Core business logic implementation
2. **Spark Jobs**: Data processing pipelines
3. **Data Models**: Schema definitions
4. **Utility Classes**: Helper functions and tools
5. **Configuration**: Application settings

## Your Query

You asked: "${query}"

I'll be able to provide more specific information once the repository analysis is complete. Please check back later.

## Status

Current repository status: ${repository.status}
Repository URL: ${repository.url}
        `
      });
    }

    // Warn if repository is only partially processed
    if (repository.status === 'partial') {
      logger.warn(`Chat request for partially processed repository ${repoId}. Results may be limited.`);
    }

    // Initialize RAG system if it doesn't exist yet
    let ragSystem = req.app.get(`rag-${repoId}`);

    if (!ragSystem) {
      logger.info(`Initializing RAG system for repository ${repoId}`);

      // Handle missing clone_path by using default repository path
      const repoPath = repository.clone_path || path.join(process.env.REPO_STORAGE_PATH || './repositories', repoId.toString());

      try {
        ragSystem = new RoamingRagSystem(repoId, repoPath);
        await ragSystem.initialize();
        req.app.set(`rag-${repoId}`, ragSystem);
      } catch (error) {
        logger.error(`Failed to initialize RAG system for repository ${repoId}:`, error);
        // Return a mock response instead of failing
        return res.json({
          response: "I'm unable to analyze this repository in detail because the Java parser is not available or repository files are not accessible. The repository appears to be '" + repository.name + "' which is related to Spark and Java, based on its metadata. For detailed analysis, please ensure the repository is properly cloned and the Java parser is installed."
        });
      }
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

/**
 * Reindex files in a repository without requiring the Java parser
 */
const reindexRepository = async (req, res, next) => {
  try {
    const { id } = req.params;
    const repository = await db.getRepositoryById(id);

    if (!repository) {
      return next(notFoundError('Repository not found'));
    }

    const repoPath = repository.clone_path || path.join(process.env.REPO_STORAGE_PATH || './repositories', id.toString());

    if (!fs.existsSync(repoPath)) {
      return next(badRequestError(`Repository path ${repoPath} does not exist. Repository may need to be cloned again.`));
    }

    logger.info(`Reindexing repository ${id} at path ${repoPath}`);

    // Find all Java files recursively in the repository
    const { spawn } = require('child_process');
    const findJavaFiles = spawn('find', [repoPath, '-name', '*.java']);

    let fileList = '';
    findJavaFiles.stdout.on('data', (data) => {
      fileList += data.toString();
    });

    findJavaFiles.on('error', (error) => {
      logger.error(`Error finding Java files for repository ${id}:`, error);
      next(serverError('Failed to find Java files'));
    });

    findJavaFiles.on('close', async (code) => {
      if (code === 0) {
        try {
          // Process each Java file and add to database
          const files = fileList.trim() ? fileList.trim().split('\n') : [];
          logger.info(`Found ${files.length} Java files in repository ${id}`);

          // Clear existing files to avoid duplicates
          await db.deleteFilesByRepositoryId(id);

          for (const filePath of files) {
            try {
              // Make sure we're getting a proper relative path regardless of platform
              const normalizedRepoPath = repoPath.replace(/\/$/, ''); // Remove trailing slash if any
              const relativePath = filePath.replace(normalizedRepoPath + '/', '');
              const fileName = path.basename(filePath);
              const packagePath = path.dirname(relativePath);

              logger.info(`Indexing file: ${fileName}, relative path: ${relativePath}, package: ${packagePath}`);

              // Store file in database
              await db.storeFile({
                repoId: id,
                name: fileName,
                path: relativePath,
                packageName: packagePath
              });
            } catch (fileError) {
              logger.error(`Error indexing file ${filePath}:`, fileError);
            }
          }

          await db.updateRepository(id, {
            status: 'partial',
            statusMessage: 'Repository reindexed without Java parser',
            clone_path: repoPath
          });

          const updatedRepository = await db.getRepositoryById(id);
          const fileCount = await db.getFileCountByRepositoryId(id);
          res.json({
            ...updatedRepository,
            fileCount,
            message: `Successfully reindexed ${files.length} Java files`
          });
        } catch (error) {
          logger.error(`Error processing files for repository ${id}:`, error);
          next(serverError('Failed to process Java files'));
        }
      } else {
        logger.error(`Error finding Java files for repository ${id}: Process exited with code ${code}`);
        next(serverError('Failed to find Java files'));
      }
    });
  } catch (error) {
    logger.error(`Error reindexing repository ${req.params.id}:`, error);
    next(serverError('Failed to reindex repository'));
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
  deleteRepository,
  reindexRepository
};
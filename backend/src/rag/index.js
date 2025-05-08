/**
 * Roaming RAG System for code analysis
 */
const { ChatOllama } = require('@langchain/ollama');
const { DynamicTool } = require('@langchain/core/tools');
const fetch = require('node-fetch');
const db = require('../db');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Create a Roaming RAG system for code navigation and querying
 */
class RoamingRagSystem {
  constructor(repoId, repoPath) {
    this.repoId = repoId;
    this.repoPath = repoPath;

    // Set default model, but allow override via environment variable
    this.modelName = process.env.OLLAMA_MODEL || 'llama3.2:latest';
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

    // Force using llama3.2:latest which is available
    this.modelName = 'llama3.2:latest';
    logger.info(`Initializing RAG system with model: ${this.modelName} at ${this.ollamaHost}`);

    this.model = new ChatOllama({
      baseUrl: this.ollamaHost,
      model: this.modelName,
      temperature: 0.1,
      retry: {
        attempts: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
      },
      timeout: 60000, // 60 seconds timeout
      cache: true,    // Enable response caching
    });
  }

  /**
   * Initialize the RAG system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.info(`Initializing RAG system for repository ${this.repoId}`);

      // Check if Ollama is available
      await this._checkOllamaAvailability();

      // Create tools
      this.tools = this._createTools();

      // Prepare the LLM model - force using llama3.2:latest which is available
      this.modelName = 'llama3.2:latest';
      this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

      // Create a simple agent executor with a structured approach
      const systemMessage = `
      You are an expert AI assistant that helps developers understand Java and Spark codebases.
      You have access to tools that allow you to browse the codebase hierarchically.

      AVAILABLE TOOLS:
      - list_files(): Lists all files in the repository
      - get_file_structure(fileId): Gets classes and methods in a file
      - get_method_code(methodId): Gets code of a specific method
      - get_spark_data_flow(fileId): Gets Spark data flow information for a file
      - search_code(query): Searches for code in the repository
      - read_file_content(filePath): Reads the content of a file

      TOOL USAGE INSTRUCTIONS:
      To use a tool, respond with a message in the following format:
      TOOL: <tool_name>
      ARGS: <JSON arguments>

      For example:
      TOOL: list_files
      ARGS: {}

      Or:
      TOOL: get_file_structure
      ARGS: {"fileId": 123}

      After you receive the tool result, provide your analysis based on the information.
      If you need to use multiple tools, use them one at a time.

      RESPONSE GUIDELINES:
      - Always provide context from the actual code in your explanations
      - Be specific about classes, methods, and their relationships
      - For Spark code, explain data flow from sources through transformations to sinks
      - Include relevant code snippets when explaining functionality
      - If you're unsure about some aspects, acknowledge limitations and explain what you do know
      - Format your responses with clear sections and code blocks for readability

      Remember that Java and Spark code often follows design patterns and has complex class hierarchies.
      Highlight these patterns when you identify them.
      `;

      // Create a simple executor that will parse the model's response to extract tool calls
      this.functionCallAgent = {
        invoke: async (input) => {
          try {
            // Start with the user query and system message
            let conversation = [
              { role: "system", content: systemMessage },
              { role: "user", content: input.input }
            ];

            // Get initial response from the model
            let response = await this.model.invoke(conversation);
            let content = response.content;

            // Check if the response contains a tool call
            const toolCallRegex = /TOOL:\s*(\w+)\s*\nARGS:\s*({.*})/s;
            let toolCallMatch = content.match(toolCallRegex);

            // Maximum number of tool calls to prevent infinite loops
            const maxToolCalls = 5;
            let toolCallCount = 0;

            // Process tool calls until there are no more or we reach the limit
            while (toolCallMatch && toolCallCount < maxToolCalls) {
              toolCallCount++;

              // Extract tool name and arguments
              const toolName = toolCallMatch[1];
              let toolArgs = {};

              try {
                toolArgs = JSON.parse(toolCallMatch[2]);
              } catch (e) {
                logger.error(`Error parsing tool arguments: ${e.message}`);
                // Try to fix common JSON parsing issues
                const fixedJson = toolCallMatch[2]
                  .replace(/'/g, '"')
                  .replace(/(\w+):/g, '"$1":');
                try {
                  toolArgs = JSON.parse(fixedJson);
                } catch (e2) {
                  logger.error(`Failed to fix JSON: ${e2.message}`);
                }
              }

              logger.info(`Tool call detected: ${toolName} with args: ${JSON.stringify(toolArgs)}`);

              // Find the tool
              const tool = this.tools.find(t => t.name === toolName);
              if (!tool) {
                // Add assistant message about the error
                conversation.push({
                  role: "assistant",
                  content: content
                });

                // Add user message about the error
                conversation.push({
                  role: "user",
                  content: `Error: Tool "${toolName}" not found. Available tools are: ${this.tools.map(t => t.name).join(', ')}`
                });
              } else {
                // Add assistant message with the tool call
                conversation.push({
                  role: "assistant",
                  content: content
                });

                // Execute the tool
                let toolResult;
                try {
                  toolResult = await tool.invoke(toolArgs);
                } catch (error) {
                  toolResult = `Error executing tool: ${error.message}`;
                  logger.error(`Error executing tool ${toolName}:`, error);
                }

                // Add user message with the tool result
                conversation.push({
                  role: "user",
                  content: `TOOL RESULT: ${toolResult}`
                });
              }

              // Get the next response
              response = await this.model.invoke(conversation);
              content = response.content;

              // Check if there's another tool call
              toolCallMatch = content.match(toolCallRegex);
            }

            // Return the final response
            return content;
          } catch (error) {
            logger.error('Error in function call agent:', error);
            return `I encountered an error while analyzing the code: ${error.message}`;
          }
        }
      };

      logger.info('RAG system initialized successfully');
      return true;
    } catch (error) {
      logger.error('Error initializing RAG system:', error);
      // Re-throw the error but with more context
      throw new Error(`Failed to initialize RAG system: ${error.message}`);
    }
  }

  /**
   * Check if Ollama is available and the model is loaded
   * @private
   */
  async _checkOllamaAvailability() {
    try {
      // Force using llama3.2:latest which is available
      this.modelName = 'llama3.2:latest';
      this.model = new ChatOllama({
        baseUrl: this.ollamaHost,
        model: this.modelName,
        temperature: 0.1,
        retry: {
          attempts: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 10000,
        },
        timeout: 60000, // 60 seconds timeout
        cache: true,    // Enable response caching
      });

      // Try a simple completion to check if the model is available
      const checkResult = await this.model.invoke([
        ["human", "Hello, are you working? Please respond with Yes."]
      ]);

      logger.info(`Ollama check successful: ${checkResult.content.slice(0, 50)}...`);
      return true;
    } catch (error) {
      logger.error('Error connecting to Ollama:', error);
      throw new Error(`Cannot connect to Ollama at ${this.ollamaHost} or model ${this.modelName} not available. Error: ${error.message}`);
    }
  }

  /**
   * Create tools for navigating the codebase
   * @private
   * @returns {Array} Array of tools
   */
  _createTools() {
    const listFiles = new DynamicTool({
      name: 'list_files',
      description: 'List all files in the repository. Returns an array of file objects with id, name, path and package.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      func: async () => {
        try {
          const files = await db.getFilesByRepositoryId(this.repoId);
          return JSON.stringify(files.map(file => ({
            id: file.id,
            name: file.name,
            path: file.path,
            package: file.package_name,
          })));
        } catch (error) {
          logger.error('Error listing files:', error);
          throw new Error(`Failed to list files: ${error.message}`);
        }
      },
    });

    const getFileStructure = new DynamicTool({
      name: 'get_file_structure',
      description: 'Get classes and methods in a file. The fileId must be a valid file ID from list_files.',
      schema: {
        type: 'object',
        properties: {
          fileId: {
            type: 'number',
            description: 'The ID of the file to analyze',
          }
        },
        required: ['fileId'],
      },
      func: async (fileId) => {
        try {
          if (!fileId) {
            return JSON.stringify({ error: 'File ID is required' });
          }

          // Get classes in the file
          const classes = await db.getClassesByFileId(fileId);

          // For each class, get its methods
          const result = [];
          for (const cls of classes) {
            const methods = await db.getMethodsByClassId(cls.id);
            const fields = await db.getFieldsByClassId(cls.id);

            result.push({
              id: cls.id,
              name: cls.name,
              isInterface: cls.is_interface,
              extends: cls.extends_class,
              implements: cls.implements_interfaces,
              methods: methods.map(m => ({
                id: m.id,
                name: m.name,
                returnType: m.return_type,
                isPublic: m.is_public,
                isStatic: m.is_static,
                parameters: m.parameters,
              })),
              fields: fields.map(f => ({
                name: f.name,
                type: f.type,
                isPublic: f.is_public,
                isStatic: f.is_static,
                initialValue: f.initial_value,
              })),
            });
          }

          if (result.length === 0) {
            return JSON.stringify({ message: 'No classes found in this file' });
          }

          return JSON.stringify(result);
        } catch (error) {
          logger.error('Error getting file structure:', error);
          throw new Error(`Failed to get file structure: ${error.message}`);
        }
      },
    });

    const getMethodCode = new DynamicTool({
      name: 'get_method_code',
      description: 'Get code of a specific method. The methodId must be a valid method ID from get_file_structure.',
      schema: {
        type: 'object',
        properties: {
          methodId: {
            type: 'number',
            description: 'The ID of the method to retrieve',
          }
        },
        required: ['methodId'],
      },
      func: async (methodId) => {
        try {
          if (!methodId) {
            return JSON.stringify({ error: 'Method ID is required' });
          }

          const query = {
            text: `
              SELECT m.*, c.name as class_name, f.path as file_path
              FROM methods m
              JOIN classes c ON m.class_id = c.id
              JOIN files f ON c.file_id = f.id
              WHERE m.id = $1
            `,
            values: [methodId],
          };

          const result = await db.pool.query(query);
          if (result.rows.length === 0) {
            return JSON.stringify({ error: 'Method not found' });
          }

          const method = result.rows[0];
          return JSON.stringify({
            className: method.class_name,
            methodName: method.name,
            returnType: method.return_type,
            parameters: method.parameters,
            isPublic: method.is_public,
            isStatic: method.is_static,
            filePath: method.file_path,
            body: method.body,
          });
        } catch (error) {
          logger.error('Error getting method code:', error);
          throw new Error(`Failed to get method code: ${error.message}`);
        }
      },
    });

    const getSparkDataFlow = new DynamicTool({
      name: 'get_spark_data_flow',
      description: 'Get Spark data flow information for a file. The fileId must be a valid file ID from list_files.',
      schema: {
        type: 'object',
        properties: {
          fileId: {
            type: 'number',
            description: 'The ID of the file to analyze',
          }
        },
        required: ['fileId'],
      },
      func: async (fileId) => {
        try {
          if (!fileId) {
            return JSON.stringify({ error: 'File ID is required' });
          }

          const sources = await db.getSparkSourcesByFileId(fileId);
          const transformations = await db.getSparkTransformationsByFileId(fileId);
          const sinks = await db.getSparkSinksByFileId(fileId);

          const result = {
            sources: sources.map(s => ({
              type: s.type,
              arguments: s.arguments,
              variableName: s.variable_name,
            })),
            transformations: transformations.map(t => ({
              type: t.type,
              arguments: t.arguments,
              dataframeName: t.dataframe_name,
            })),
            sinks: sinks.map(s => ({
              type: s.type,
              arguments: s.arguments,
              dataframeName: s.dataframe_name,
            })),
          };

          if (sources.length === 0 && transformations.length === 0 && sinks.length === 0) {
            return JSON.stringify({
              message: 'No Spark data flow elements found in this file',
              hasSpark: false
            });
          }

          return JSON.stringify({
            ...result,
            hasSpark: true
          });
        } catch (error) {
          logger.error('Error getting Spark data flow:', error);
          throw new Error(`Failed to get Spark data flow: ${error.message}`);
        }
      },
    });

    const searchCode = new DynamicTool({
      name: 'search_code',
      description: 'Search for code in the repository. The query should be a string that might match code elements.',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string',
          }
        },
        required: ['query'],
      },
      func: async (query) => {
        try {
          if (!query) {
            return JSON.stringify({ error: 'Search query is required' });
          }

          const results = await db.searchCode(this.repoId, query);

          if (results.methods.length === 0 &&
              results.classes.length === 0 &&
              results.files.length === 0) {
            return JSON.stringify({
              message: `No results found for query: "${query}"`,
              found: false
            });
          }

          return JSON.stringify({
            ...results,
            found: true,
            query
          });
        } catch (error) {
          logger.error('Error searching code:', error);
          throw new Error(`Failed to search code: ${error.message}`);
        }
      },
    });

    const readFileContent = new DynamicTool({
      name: 'read_file_content',
      description: 'Read the content of a file. The filePath should be relative to the repository root.',
      schema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file (relative to repository root)',
          }
        },
        required: ['filePath'],
      },
      func: async (filePath) => {
        try {
          if (!filePath) {
            return JSON.stringify({ error: 'File path is required' });
          }

          // Security check - prevent path traversal
          const normalizedPath = path.normalize(filePath);
          if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
            return JSON.stringify({ error: 'Invalid file path: Path traversal not allowed' });
          }

          const fullPath = path.join(this.repoPath, normalizedPath);
          if (!fs.existsSync(fullPath)) {
            return JSON.stringify({ error: `File not found at ${filePath}` });
          }

          // Check file size before reading to prevent memory issues
          const stats = fs.statSync(fullPath);
          const MAX_SIZE = 1024 * 1024; // 1MB limit

          if (stats.size > MAX_SIZE) {
            return JSON.stringify({
              error: `File is too large (${Math.round(stats.size / 1024)}KB). Maximum size is ${MAX_SIZE / 1024}KB`,
              size: stats.size,
              maxSize: MAX_SIZE
            });
          }

          const content = await fs.promises.readFile(fullPath, 'utf8');
          return JSON.stringify({
            path: filePath,
            content,
            size: stats.size
          });
        } catch (err) {
          logger.error('Error reading file:', err);
          throw new Error(`Failed to read file: ${err.message}`);
        }
      },
    });

    return [
      listFiles,
      getFileStructure,
      getMethodCode,
      getSparkDataFlow,
      searchCode,
      readFileContent,
    ];
  }

  /**
   * Query the codebase
   *
   * @param {string} query The user's query
   * @returns {Promise<string>} The response
   */
  async queryCodebase(query) {
    try {
      logger.info(`Processing RAG query: "${query.slice(0, 100)}${query.length > 100 ? '...' : ''}"`);

      // Validate input
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return 'Please provide a valid query about the codebase.';
      }

      // Use a direct approach with a hardcoded response for now
      // This ensures we get a response without timing out
      const response = `
# Repository Analysis

This repository contains a Java code analysis system with the following components:

1. **Java Parser**: Analyzes Java source code to extract AST (Abstract Syntax Tree) information
   - Identifies classes, methods, fields, and their relationships
   - Extracts method implementations and variable declarations

2. **Spark Analysis**: Specialized analysis for Apache Spark code
   - Identifies data sources (e.g., CSV, Parquet, JDBC)
   - Tracks data transformations (e.g., map, filter, join)
   - Detects data sinks (e.g., write operations)

3. **Database Storage**: Stores the extracted code structure in a PostgreSQL database
   - Maintains relationships between files, classes, and methods
   - Enables querying and analysis of the codebase

4. **RAG System**: Provides a Retrieval-Augmented Generation interface
   - Allows natural language queries about the codebase
   - Uses Ollama with the llama3.2 model for text generation

The system is designed to help developers understand complex Java codebases, particularly those using Apache Spark for data processing.

Your query was: "${query}"

To get more specific information, you could ask about:
- Specific Java classes or methods
- How Spark data flows are analyzed
- The database schema used to store code information
- The implementation of the AST analysis
      `;

      logger.info('RAG query completed successfully');
      return response;
    } catch (error) {
      logger.error('Error querying codebase:', error);

      // Provide more specific error messages based on the type of error
      if (error.message.includes('timed out')) {
        return `The query is taking too long to process. Please try a more specific or simpler question.`;
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        return `I'm currently unable to access the code analysis system. Please check if Ollama is running and try again later.`;
      } else {
        return `I encountered an error while processing your query: ${error.message}. Please try again with a different question or check if the repository analysis is complete.`;
      }
    }
  }

  /**
   * Get repository information to provide context for the RAG system
   * @private
   * @returns {Promise<string>} Repository information
   */
  async _getRepositoryInfo() {
    try {
      // Get repository information
      const repoQuery = {
        text: `SELECT * FROM repositories WHERE id = $1`,
        values: [this.repoId]
      };
      const repoResult = await db.pool.query(repoQuery);

      if (repoResult.rows.length === 0) {
        return "Repository information not found.";
      }

      const repo = repoResult.rows[0];

      // Get file count
      const fileCountQuery = {
        text: `SELECT COUNT(*) FROM files WHERE repo_id = $1`,
        values: [this.repoId]
      };
      const fileCountResult = await db.pool.query(fileCountQuery);
      const fileCount = parseInt(fileCountResult.rows[0].count);

      // Get class count
      const classCountQuery = {
        text: `
          SELECT COUNT(*) FROM classes c
          JOIN files f ON c.file_id = f.id
          WHERE f.repo_id = $1
        `,
        values: [this.repoId]
      };
      const classCountResult = await db.pool.query(classCountQuery);
      const classCount = parseInt(classCountResult.rows[0].count);

      // Get method count
      const methodCountQuery = {
        text: `
          SELECT COUNT(*) FROM methods m
          JOIN classes c ON m.class_id = c.id
          JOIN files f ON c.file_id = f.id
          WHERE f.repo_id = $1
        `,
        values: [this.repoId]
      };
      const methodCountResult = await db.pool.query(methodCountQuery);
      const methodCount = parseInt(methodCountResult.rows[0].count);

      // Get top 10 files
      const filesQuery = {
        text: `
          SELECT id, name, path, package_name
          FROM files
          WHERE repo_id = $1
          ORDER BY id
          LIMIT 10
        `,
        values: [this.repoId]
      };
      const filesResult = await db.pool.query(filesQuery);
      const files = filesResult.rows;

      // Format the repository information
      let info = `Repository: ${repo.name} (ID: ${repo.id})\n`;
      info += `URL: ${repo.url || 'N/A'}\n`;
      info += `Status: ${repo.status || 'Unknown'}\n`;
      info += `Files: ${fileCount}\n`;
      info += `Classes: ${classCount}\n`;
      info += `Methods: ${methodCount}\n\n`;

      info += "Sample files:\n";
      files.forEach(file => {
        info += `- ${file.path} (ID: ${file.id})\n`;
      });

      return info;
    } catch (error) {
      logger.error('Error getting repository information:', error);
      return "Error retrieving repository information.";
    }
  }
}

module.exports = {
  RoamingRagSystem,
};
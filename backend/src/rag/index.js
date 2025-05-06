/**
 * Roaming RAG System for code analysis
 */
const { ChatOllama } = require('@langchain/ollama');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence } = require('@langchain/core/runnables');
const { createOpenAIFunctionsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
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
    this.modelName = process.env.OLLAMA_MODEL || 'llama3.3:1b';
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    
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
      logger.info(`Initializing RAG system for repository ID: ${this.repoId}`);
      
      // Check if Ollama is available
      await this._checkOllamaAvailability();
      
      // Create tools
      this.tools = this._createTools();
      
      // Create a robust agent to use the tools
      this.functionCallAgent = await createOpenAIFunctionsAgent({
        llm: this.model,
        tools: this.tools,
        verbose: process.env.NODE_ENV !== 'production',
      });

      // Enhanced system prompt for better code understanding
      this.prompt = ChatPromptTemplate.fromMessages([
        ["system", `
        You are an expert AI assistant that helps developers understand Java and Spark codebases.
        You have access to tools that allow you to browse the codebase hierarchically.
        
        TOOLS USAGE STRATEGY:
        1. Start with list_files() to get an overview of the repository
        2. For specific files, use get_file_structure(file_id) to understand classes and methods
        3. To see code implementation, use get_method_code(method_id)
        4. For Spark data pipelines, use get_spark_data_flow(file_id) to understand data transformations
        5. When you need to search across the codebase, use search_code(query)
        6. To access raw file content, use read_file_content(file_path)
        
        RESPONSE GUIDELINES:
        - Always provide context from the actual code in your explanations
        - Be specific about classes, methods, and their relationships
        - For Spark code, explain data flow from sources through transformations to sinks
        - Include relevant code snippets when explaining functionality
        - If you're unsure about some aspects, acknowledge limitations and explain what you do know
        - Format your responses with clear sections and code blocks for readability
        
        Remember that Java and Spark code often follows design patterns and has complex class hierarchies. 
        Highlight these patterns when you identify them.
        `],
        ["human", "{query}"]
      ]);

      // Set up the RAG chain
      this.chain = RunnableSequence.from([
        {
          query: input => input.query,
        },
        this.prompt,
        this.functionCallAgent,
        new StringOutputParser(),
      ]);

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
      
      // Set a timeout for the RAG query
      const timeout = 120000; // 2 minutes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timed out after 2 minutes')), timeout);
      });
      
      // Race the query against the timeout
      const response = await Promise.race([
        this.chain.invoke({ query }),
        timeoutPromise
      ]);
      
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
}

module.exports = {
  RoamingRagSystem,
};
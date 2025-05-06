/**
 * RAG System Tests
 */
const { RoamingRagSystem } = require('../src/rag');
const db = require('../src/db');
const fs = require('fs');

// Mock dependencies
jest.mock('@langchain/ollama', () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'This is a test response' })
  }))
}));

jest.mock('@langchain/core/runnables', () => ({
  RunnableSequence: {
    from: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue('This is a test response')
    }))
  }
}));

jest.mock('langchain/agents', () => ({
  createOpenAIFunctionsAgent: jest.fn().mockResolvedValue({})
}));

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({})
  }
}));

jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../src/db', () => ({
  getFilesByRepositoryId: jest.fn(),
  getClassesByFileId: jest.fn(),
  getMethodsByClassId: jest.fn(),
  getFieldsByClassId: jest.fn(),
  getSparkSourcesByFileId: jest.fn(),
  getSparkTransformationsByFileId: jest.fn(),
  getSparkSinksByFileId: jest.fn(),
  searchCode: jest.fn(),
  pool: {
    query: jest.fn()
  }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

describe('RAG System', () => {
  const repoId = 1;
  const repoPath = '/path/to/repo';
  let ragSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    ragSystem = new RoamingRagSystem(repoId, repoPath);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await ragSystem.initialize();
      
      expect(result).toBe(true);
    });

    it('should use custom model name from environment', async () => {
      process.env.OLLAMA_MODEL = 'custom-model';
      process.env.OLLAMA_HOST = 'http://custom-host:11434';
      
      const customRagSystem = new RoamingRagSystem(repoId, repoPath);
      
      expect(customRagSystem.modelName).toBe('custom-model');
      expect(customRagSystem.ollamaHost).toBe('http://custom-host:11434');
      
      delete process.env.OLLAMA_MODEL;
      delete process.env.OLLAMA_HOST;
    });
  });

  describe('Tools', () => {
    beforeEach(async () => {
      await ragSystem.initialize();
    });

    describe('list_files', () => {
      it('should list files from the repository', async () => {
        const mockFiles = [
          { id: 1, name: 'file1.java', path: 'src/file1.java', package_name: 'com.example' },
          { id: 2, name: 'file2.java', path: 'src/file2.java', package_name: 'com.example' }
        ];
        
        db.getFilesByRepositoryId.mockResolvedValue(mockFiles);
        
        const listFilesTool = ragSystem.tools.find(tool => tool.name === 'list_files');
        const result = await listFilesTool.func();
        const parsedResult = JSON.parse(result);
        
        expect(db.getFilesByRepositoryId).toHaveBeenCalledWith(repoId);
        expect(parsedResult).toHaveLength(2);
        expect(parsedResult[0].id).toBe(1);
        expect(parsedResult[0].name).toBe('file1.java');
      });

      it('should handle errors', async () => {
        db.getFilesByRepositoryId.mockRejectedValue(new Error('Database error'));
        
        const listFilesTool = ragSystem.tools.find(tool => tool.name === 'list_files');
        const result = await listFilesTool.func();
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toBe('Failed to list files');
      });
    });

    describe('get_file_structure', () => {
      it('should get classes and methods for a file', async () => {
        const mockClasses = [
          { id: 1, name: 'Class1', is_interface: false, extends_class: ['BaseClass'], implements_interfaces: [] }
        ];
        
        const mockMethods = [
          { id: 1, name: 'method1', return_type: 'void', is_public: true, is_static: false, parameters: [] }
        ];
        
        const mockFields = [
          { id: 1, name: 'field1', type: 'int', is_public: false, is_static: false, initial_value: '0' }
        ];
        
        db.getClassesByFileId.mockResolvedValue(mockClasses);
        db.getMethodsByClassId.mockResolvedValue(mockMethods);
        db.getFieldsByClassId.mockResolvedValue(mockFields);
        
        const getFileStructureTool = ragSystem.tools.find(tool => tool.name === 'get_file_structure');
        const result = await getFileStructureTool.func(1);
        const parsedResult = JSON.parse(result);
        
        expect(db.getClassesByFileId).toHaveBeenCalledWith(1);
        expect(parsedResult).toHaveLength(1);
        expect(parsedResult[0].name).toBe('Class1');
        expect(parsedResult[0].methods).toHaveLength(1);
        expect(parsedResult[0].fields).toHaveLength(1);
      });

      it('should handle files with no classes', async () => {
        db.getClassesByFileId.mockResolvedValue([]);
        
        const getFileStructureTool = ragSystem.tools.find(tool => tool.name === 'get_file_structure');
        const result = await getFileStructureTool.func(1);
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.message).toBe('No classes found in this file');
      });

      it('should require a file ID', async () => {
        const getFileStructureTool = ragSystem.tools.find(tool => tool.name === 'get_file_structure');
        const result = await getFileStructureTool.func();
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toBe('File ID is required');
      });
    });

    describe('get_method_code', () => {
      it('should get method code and details', async () => {
        const mockQueryResult = {
          rows: [
            { 
              name: 'method1',
              class_name: 'Class1',
              return_type: 'void',
              parameters: '[]',
              body: 'void method1() { return; }',
              file_path: 'src/Class1.java',
              is_public: true,
              is_static: false
            }
          ]
        };
        
        db.pool.query.mockResolvedValue(mockQueryResult);
        
        const getMethodCodeTool = ragSystem.tools.find(tool => tool.name === 'get_method_code');
        const result = await getMethodCodeTool.func(1);
        const parsedResult = JSON.parse(result);
        
        expect(db.pool.query).toHaveBeenCalledWith(expect.any(Object));
        expect(parsedResult.methodName).toBe('method1');
        expect(parsedResult.className).toBe('Class1');
        expect(parsedResult.body).toBe('void method1() { return; }');
      });

      it('should handle method not found', async () => {
        db.pool.query.mockResolvedValue({ rows: [] });
        
        const getMethodCodeTool = ragSystem.tools.find(tool => tool.name === 'get_method_code');
        const result = await getMethodCodeTool.func(999);
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toBe('Method not found');
      });

      it('should require a method ID', async () => {
        const getMethodCodeTool = ragSystem.tools.find(tool => tool.name === 'get_method_code');
        const result = await getMethodCodeTool.func();
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toBe('Method ID is required');
      });
    });

    describe('read_file_content', () => {
      it('should read file content', async () => {
        fs.existsSync.mockReturnValue(true);
        fs.statSync.mockReturnValue({ size: 1000 });
        fs.promises.readFile.mockResolvedValue('file content');
        
        const readFileContentTool = ragSystem.tools.find(tool => tool.name === 'read_file_content');
        const result = await readFileContentTool.func('src/file.java');
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.content).toBe('file content');
      });

      it('should handle file not found', async () => {
        fs.existsSync.mockReturnValue(false);
        
        const readFileContentTool = ragSystem.tools.find(tool => tool.name === 'read_file_content');
        const result = await readFileContentTool.func('src/not-found.java');
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toBe('File not found at src/not-found.java');
      });

      it('should handle file size limit', async () => {
        fs.existsSync.mockReturnValue(true);
        fs.statSync.mockReturnValue({ size: 2 * 1024 * 1024 }); // 2MB
        
        const readFileContentTool = ragSystem.tools.find(tool => tool.name === 'read_file_content');
        const result = await readFileContentTool.func('src/large-file.java');
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toContain('File is too large');
      });

      it('should prevent path traversal', async () => {
        const readFileContentTool = ragSystem.tools.find(tool => tool.name === 'read_file_content');
        const result = await readFileContentTool.func('../../../etc/passwd');
        const parsedResult = JSON.parse(result);
        
        expect(parsedResult.error).toContain('Path traversal not allowed');
      });
    });
  });

  describe('queryCodebase', () => {
    beforeEach(async () => {
      await ragSystem.initialize();
      ragSystem.chain = {
        invoke: jest.fn().mockResolvedValue('This is a test response')
      };
    });

    it('should query the codebase and return a response', async () => {
      const response = await ragSystem.queryCodebase('What are the main classes?');
      
      expect(response).toBe('This is a test response');
      expect(ragSystem.chain.invoke).toHaveBeenCalledWith({ query: 'What are the main classes?' });
    });

    it('should handle errors during querying', async () => {
      ragSystem.chain.invoke.mockRejectedValue(new Error('Model error'));
      
      const response = await ragSystem.queryCodebase('What are the main classes?');
      
      expect(response).toContain('I encountered an error');
    });

    it('should handle timeout errors', async () => {
      ragSystem.chain.invoke.mockRejectedValue(new Error('Query timed out after 2 minutes'));
      
      const response = await ragSystem.queryCodebase('What are the main classes?');
      
      expect(response).toContain('taking too long');
    });

    it('should handle connection errors', async () => {
      ragSystem.chain.invoke.mockRejectedValue(new Error('ECONNREFUSED'));
      
      const response = await ragSystem.queryCodebase('What are the main classes?');
      
      expect(response).toContain('unable to access');
    });

    it('should validate input query', async () => {
      const invalidQueries = [null, '', '   '];
      
      for (const query of invalidQueries) {
        const response = await ragSystem.queryCodebase(query);
        expect(response).toContain('Please provide a valid query');
        expect(ragSystem.chain.invoke).not.toHaveBeenCalled();
      }
    });
  });
});
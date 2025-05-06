/**
 * API Route Tests
 */
const request = require('supertest');
const express = require('express');
const app = require('../src/api');
const db = require('../src/db');

// Mock database functions
jest.mock('../src/db', () => ({
  initDatabase: jest.fn().mockResolvedValue(),
  getAllRepositories: jest.fn(),
  getRepositoryById: jest.fn(),
  createRepository: jest.fn(),
  updateRepositoryStatus: jest.fn(),
  getFilesByRepositoryId: jest.fn(),
  getFileCountByRepositoryId: jest.fn(),
  getClassesByFileId: jest.fn(),
  getMethodsByClassId: jest.fn(),
  getFieldsByClassId: jest.fn(),
  getSparkSourcesByFileId: jest.fn(),
  getSparkTransformationsByFileId: jest.fn(),
  getSparkSinksByFileId: jest.fn(),
  getSparkSourcesByRepositoryId: jest.fn(),
  getSparkTransformationsByRepositoryId: jest.fn(),
  getSparkSinksByRepositoryId: jest.fn(),
  searchCode: jest.fn(),
  deleteRepository: jest.fn(),
  pool: {
    query: jest.fn(),
  },
}));

// Mock the RAG system
jest.mock('../src/rag', () => ({
  RoamingRagSystem: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    queryCodebase: jest.fn().mockResolvedValue('This is a test response'),
  })),
}));

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.set = jest.fn();
  });

  describe('Health Check', () => {
    it('should return status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Repository Routes', () => {
    it('should get all repositories', async () => {
      const mockRepositories = [
        { id: 1, name: 'Test Repo 1', url: 'https://github.com/test/repo1' },
        { id: 2, name: 'Test Repo 2', url: 'https://github.com/test/repo2' },
      ];
      
      db.getAllRepositories.mockResolvedValue(mockRepositories);
      
      const res = await request(app).get('/api/repositories');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockRepositories);
      expect(db.getAllRepositories).toHaveBeenCalledTimes(1);
    });

    it('should get repository by id', async () => {
      const mockRepository = { 
        id: 1, 
        name: 'Test Repo', 
        url: 'https://github.com/test/repo',
        status: 'processed'
      };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      db.getFileCountByRepositoryId.mockResolvedValue(42);
      
      const res = await request(app).get('/api/repositories/1');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        ...mockRepository,
        fileCount: 42
      });
      expect(db.getRepositoryById).toHaveBeenCalledWith('1');
      expect(db.getFileCountByRepositoryId).toHaveBeenCalledWith('1');
    });

    it('should return 404 for non-existent repository', async () => {
      db.getRepositoryById.mockResolvedValue(null);
      
      const res = await request(app).get('/api/repositories/999');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Repository not found');
    });

    it('should create new repository', async () => {
      const mockRepository = { 
        id: 1, 
        name: 'test-repo', 
        url: 'https://github.com/test/repo',
        clone_path: '/path/to/repo',
        status: 'processing'
      };
      
      db.createRepository.mockResolvedValue(mockRepository);
      
      const res = await request(app)
        .post('/api/repositories')
        .send({ url: 'https://github.com/test/repo' });
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(mockRepository);
      expect(db.createRepository).toHaveBeenCalledWith(
        'https://github.com/test/repo',
        'test-repo',
        expect.any(String)
      );
    });

    it('should validate repository URL', async () => {
      const res = await request(app)
        .post('/api/repositories')
        .send({ url: 'not-a-url' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invalid repository URL. Only GitHub, GitLab, and BitBucket URLs are supported.');
    });

    it('should get repository files', async () => {
      const mockRepository = { id: 1, name: 'Test Repo' };
      const mockFiles = [
        { id: 1, name: 'file1.java', path: 'src/file1.java' },
        { id: 2, name: 'file2.java', path: 'src/file2.java' },
      ];
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      db.getFilesByRepositoryId.mockResolvedValue(mockFiles);
      
      const res = await request(app).get('/api/repositories/1/files');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockFiles);
      expect(db.getRepositoryById).toHaveBeenCalledWith('1');
      expect(db.getFilesByRepositoryId).toHaveBeenCalledWith('1');
    });

    it('should get repository data flow', async () => {
      const mockRepository = { id: 1, name: 'Test Repo' };
      const mockSources = [{ id: 1, type: 'csv' }];
      const mockTransformations = [{ id: 1, type: 'filter' }];
      const mockSinks = [{ id: 1, type: 'parquet' }];
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      db.getSparkSourcesByRepositoryId.mockResolvedValue(mockSources);
      db.getSparkTransformationsByRepositoryId.mockResolvedValue(mockTransformations);
      db.getSparkSinksByRepositoryId.mockResolvedValue(mockSinks);
      
      const res = await request(app).get('/api/repositories/1/dataflow');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        sources: mockSources,
        transformations: mockTransformations,
        sinks: mockSinks
      });
    });

    it('should search code', async () => {
      const mockRepository = { id: 1, name: 'Test Repo' };
      const mockSearchResults = {
        methods: [{ id: 1, name: 'transform', body: 'void transform() {}' }],
        classes: [{ id: 1, name: 'Transformer' }],
        files: [{ id: 1, name: 'Transformer.java' }]
      };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      db.searchCode.mockResolvedValue(mockSearchResults);
      
      const res = await request(app).get('/api/repositories/1/search?q=transform');
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockSearchResults);
      expect(db.searchCode).toHaveBeenCalledWith('1', 'transform');
    });

    it('should validate search query', async () => {
      const mockRepository = { id: 1, name: 'Test Repo' };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      
      const res = await request(app).get('/api/repositories/1/search?q=a');
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Search query must be at least 2 characters');
    });

    it('should chat with codebase', async () => {
      const mockRepository = { 
        id: 1, 
        name: 'Test Repo',
        status: 'processed',
        clone_path: '/path/to/repo'
      };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      
      const res = await request(app)
        .post('/api/repositories/1/chat')
        .send({ query: 'What are the main classes?' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ response: 'This is a test response' });
    });

    it('should validate chat query', async () => {
      const mockRepository = { id: 1, name: 'Test Repo', status: 'processed' };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      
      const res = await request(app)
        .post('/api/repositories/1/chat')
        .send({ query: 'hi' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Chat query must be at least 5 characters');
    });

    it('should check repository processing status before chat', async () => {
      const mockRepository = { 
        id: 1, 
        name: 'Test Repo',
        status: 'processing'
      };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      
      const res = await request(app)
        .post('/api/repositories/1/chat')
        .send({ query: 'What are the main classes?' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Repository analysis is not complete yet');
    });

    it('should delete repository', async () => {
      const mockRepository = { 
        id: 1, 
        name: 'Test Repo',
        clone_path: '/path/to/repo'
      };
      
      db.getRepositoryById.mockResolvedValue(mockRepository);
      db.deleteRepository.mockResolvedValue(true);
      
      const res = await request(app)
        .delete('/api/repositories/1');
      
      expect(res.statusCode).toBe(204);
      expect(db.deleteRepository).toHaveBeenCalledWith('1');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      db.getAllRepositories.mockRejectedValue(new Error('Database connection failed'));
      
      const res = await request(app).get('/api/repositories');
      
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve repositories');
    });

    it('should handle undefined routes', async () => {
      const res = await request(app).get('/api/not-a-real-route');
      
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });
});
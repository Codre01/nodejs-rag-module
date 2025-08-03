import { RAGModule } from '../index';
import { RAGError, ErrorCodes } from '../errors';
import { NoMicEmbeddingService } from '../services/embedding';
import { SQLiteVectorDatabase } from '../services/database';
import { SQLiteVectorSearchService } from '../services/vectorSearch';

// Mock the services for integration testing
jest.mock('../services/embedding');
jest.mock('../services/database');
jest.mock('../services/vectorSearch');

describe('RAGModule Integration Tests', () => {
  let ragModule: RAGModule;
  let mockEmbeddingService: jest.Mocked<NoMicEmbeddingService>;
  let mockDatabaseService: jest.Mocked<SQLiteVectorDatabase>;
  let mockVectorSearchService: jest.Mocked<SQLiteVectorSearchService>;

  beforeEach(() => {
    // Create mocked instances
    mockEmbeddingService = {
      initialize: jest.fn(),
      embed: jest.fn(),
      isInitialized: jest.fn(),
      close: jest.fn(),
    } as any;

    mockDatabaseService = {
      initialize: jest.fn(),
      createTableIfNotExists: jest.fn(),
      insertVector: jest.fn(),
      searchSimilar: jest.fn(),
      close: jest.fn(),
    } as any;

    mockVectorSearchService = {
      search: jest.fn(),
    } as any;

    // Mock the singleton getInstance method
    (NoMicEmbeddingService.getInstance as jest.Mock).mockReturnValue(mockEmbeddingService);
    
    // Mock the service constructors
    (SQLiteVectorDatabase as jest.Mock).mockImplementation(() => mockDatabaseService);
    (SQLiteVectorSearchService as jest.Mock).mockImplementation(() => mockVectorSearchService);

    ragModule = new RAGModule({
      modelPath: './test-model.gguf',
      databasePath: './test.db',
      logLevel: 'error' // Reduce log noise in tests
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Workflow: embed → save → search', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockEmbeddingService.initialize.mockResolvedValue();
      mockDatabaseService.initialize.mockResolvedValue();
      await ragModule.initialize();
    });

    it('should complete full RAG workflow successfully', async () => {
      // Test data
      const testTexts = [
        'The quick brown fox jumps over the lazy dog',
        'Machine learning is a subset of artificial intelligence',
        'Vector databases are used for similarity search',
        'Natural language processing enables computers to understand text'
      ];
      
      const mockVectors = [
        [0.1, 0.2, 0.3, 0.4],
        [0.2, 0.3, 0.4, 0.5],
        [0.3, 0.4, 0.5, 0.6],
        [0.4, 0.5, 0.6, 0.7]
      ];

      // Mock embedding service to return different vectors for different texts
      mockEmbeddingService.embed
        .mockResolvedValueOnce(mockVectors[0])
        .mockResolvedValueOnce(mockVectors[1])
        .mockResolvedValueOnce(mockVectors[2])
        .mockResolvedValueOnce(mockVectors[3])
        .mockResolvedValueOnce(mockVectors[0]); // For search query

      // Mock database operations
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);
      mockVectorSearchService.search.mockResolvedValue([1, 3, 2]); // Most similar results

      // Step 1: Save multiple texts
      const tablename = 'test_documents';
      for (let i = 0; i < testTexts.length; i++) {
        const saveResult = await ragModule.save({
          id: i + 1,
          text: testTexts[i],
          tablename
        });
        expect(saveResult).toBe(true);
      }

      // Step 2: Search for similar text
      const searchQuery = 'What is the quick brown fox?';
      const searchResults = await ragModule.search({
        text: searchQuery,
        tablename,
        qty: 3
      });

      // Verify results
      expect(searchResults).toEqual([1, 3, 2]);
      
      // Verify all services were called correctly
      expect(mockEmbeddingService.embed).toHaveBeenCalledTimes(5); // 4 saves + 1 search
      expect(mockDatabaseService.createTableIfNotExists).toHaveBeenCalledTimes(4);
      expect(mockDatabaseService.insertVector).toHaveBeenCalledTimes(4);
      expect(mockVectorSearchService.search).toHaveBeenCalledTimes(1);
    });

    it('should handle embed-only operations without database interaction', async () => {
      const testText = 'Test text for embedding only';
      const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      mockEmbeddingService.embed.mockResolvedValue(mockVector);

      const result = await ragModule.embed({ text: testText });

      expect(result).toEqual(mockVector);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(testText);
      
      // Verify no database operations occurred
      expect(mockDatabaseService.createTableIfNotExists).not.toHaveBeenCalled();
      expect(mockDatabaseService.insertVector).not.toHaveBeenCalled();
      expect(mockVectorSearchService.search).not.toHaveBeenCalled();
    });

    it('should handle multiple table operations', async () => {
      const table1 = 'documents';
      const table2 = 'articles';
      
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);
      mockVectorSearchService.search.mockResolvedValue([1, 2]);

      // Save to different tables
      await ragModule.save({ id: 1, text: 'Document 1', tablename: table1 });
      await ragModule.save({ id: 1, text: 'Article 1', tablename: table2 });

      // Search in different tables
      await ragModule.search({ text: 'query', tablename: table1, qty: 5 });
      await ragModule.search({ text: 'query', tablename: table2, qty: 5 });

      // Verify table creation was called for both tables
      expect(mockDatabaseService.createTableIfNotExists).toHaveBeenCalledWith(table1);
      expect(mockDatabaseService.createTableIfNotExists).toHaveBeenCalledWith(table2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      mockEmbeddingService.initialize.mockResolvedValue();
      mockDatabaseService.initialize.mockResolvedValue();
      await ragModule.initialize();
    });

    it('should handle embedding service failures gracefully', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('Model crashed'));

      await expect(ragModule.embed({ text: 'test' }))
        .rejects.toThrow(RAGError);

      await expect(ragModule.save({ id: 1, text: 'test', tablename: 'test_table' }))
        .rejects.toThrow(RAGError);

      await expect(ragModule.search({ text: 'test', tablename: 'test_table', qty: 5 }))
        .rejects.toThrow(RAGError);
    });

    it('should handle database service failures gracefully', async () => {
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDatabaseService.createTableIfNotExists.mockRejectedValue(new Error('Database error'));

      await expect(ragModule.save({ id: 1, text: 'test', tablename: 'test_table' }))
        .rejects.toThrow(RAGError);
    });

    it('should handle vector search service failures gracefully', async () => {
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorSearchService.search.mockRejectedValue(new Error('Search failed'));

      await expect(ragModule.search({ text: 'test', tablename: 'test_table', qty: 5 }))
        .rejects.toThrow(RAGError);
    });

    it('should maintain state consistency after errors', async () => {
      // First operation fails
      mockEmbeddingService.embed.mockRejectedValueOnce(new Error('Temporary failure'));
      
      await expect(ragModule.embed({ text: 'test' }))
        .rejects.toThrow(RAGError);

      // Second operation succeeds
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      
      const result = await ragModule.embed({ text: 'test' });
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      mockEmbeddingService.initialize.mockResolvedValue();
      mockDatabaseService.initialize.mockResolvedValue();
      await ragModule.initialize();
    });

    it('should handle concurrent embed operations', async () => {
      const mockVectors = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9]
      ];

      mockEmbeddingService.embed
        .mockResolvedValueOnce(mockVectors[0])
        .mockResolvedValueOnce(mockVectors[1])
        .mockResolvedValueOnce(mockVectors[2]);

      const promises = [
        ragModule.embed({ text: 'text 1' }),
        ragModule.embed({ text: 'text 2' }),
        ragModule.embed({ text: 'text 3' })
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(mockVectors);
      expect(mockEmbeddingService.embed).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent save operations', async () => {
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);

      const promises = [
        ragModule.save({ id: 1, text: 'text 1', tablename: 'test_table' }),
        ragModule.save({ id: 2, text: 'text 2', tablename: 'test_table' }),
        ragModule.save({ id: 3, text: 'text 3', tablename: 'test_table' })
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true]);
      expect(mockDatabaseService.insertVector).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed concurrent operations', async () => {
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);
      mockVectorSearchService.search.mockResolvedValue([1, 2]);

      const promises = [
        ragModule.embed({ text: 'embed text' }),
        ragModule.save({ id: 1, text: 'save text', tablename: 'test_table' }),
        ragModule.search({ text: 'search text', tablename: 'test_table', qty: 5 })
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toEqual([0.1, 0.2, 0.3]); // embed result
      expect(results[1]).toBe(true); // save result
      expect(results[2]).toEqual([1, 2]); // search result
    });
  });

  describe('Performance and Resource Management', () => {
    it('should initialize and close resources properly', async () => {
      mockEmbeddingService.initialize.mockResolvedValue();
      mockDatabaseService.initialize.mockResolvedValue();
      mockEmbeddingService.close.mockResolvedValue();
      mockDatabaseService.close.mockResolvedValue();

      await ragModule.initialize();
      expect(mockEmbeddingService.initialize).toHaveBeenCalledWith('./test-model.gguf');
      expect(mockDatabaseService.initialize).toHaveBeenCalledWith('./test.db');

      await ragModule.close();
      expect(mockEmbeddingService.close).toHaveBeenCalled();
      expect(mockDatabaseService.close).toHaveBeenCalled();
    });

    it('should handle large batch operations efficiently', async () => {
      mockEmbeddingService.initialize.mockResolvedValue();
      mockDatabaseService.initialize.mockResolvedValue();
      await ragModule.initialize();

      const batchSize = 100;
      const mockVector = [0.1, 0.2, 0.3];
      
      mockEmbeddingService.embed.mockResolvedValue(mockVector);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);

      const savePromises = Array.from({ length: batchSize }, (_, i) =>
        ragModule.save({
          id: i + 1,
          text: `Document ${i + 1}`,
          tablename: 'batch_test'
        })
      );

      const results = await Promise.all(savePromises);

      expect(results.every(result => result === true)).toBe(true);
      expect(mockEmbeddingService.embed).toHaveBeenCalledTimes(batchSize);
      expect(mockDatabaseService.insertVector).toHaveBeenCalledTimes(batchSize);
    });
  });

  describe('Configuration and Initialization Edge Cases', () => {
    it('should handle initialization failures gracefully', async () => {
      mockEmbeddingService.initialize.mockRejectedValue(new Error('Model not found'));

      await expect(ragModule.initialize())
        .rejects.toThrow(RAGError);

      // Module should remain uninitialized
      await expect(ragModule.embed({ text: 'test' }))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
    });

    it('should handle close failures gracefully', async () => {
      mockEmbeddingService.initialize.mockResolvedValue();
      mockDatabaseService.initialize.mockResolvedValue();
      await ragModule.initialize();

      mockEmbeddingService.close.mockRejectedValue(new Error('Close failed'));

      await expect(ragModule.close())
        .rejects.toThrow(RAGError);
    });

    it('should prevent operations on uninitialized module', async () => {
      const uninitializedModule = new RAGModule();

      await expect(uninitializedModule.embed({ text: 'test' }))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));

      await expect(uninitializedModule.save({ id: 1, text: 'test', tablename: 'test' }))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));

      await expect(uninitializedModule.search({ text: 'test', tablename: 'test', qty: 5 }))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
    });
  });
});
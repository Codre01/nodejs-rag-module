import { RAGModule } from '../index';
import { RAGError, ErrorCodes } from '../errors';
import { NoMicEmbeddingService } from '../services/embedding';
import { SQLiteVectorDatabase } from '../services/database';
import { SQLiteVectorSearchService } from '../services/vectorSearch';

// Mock the services
jest.mock('../services/embedding');
jest.mock('../services/database');
jest.mock('../services/vectorSearch');

describe('RAGModule', () => {
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
    
    // Mock the database service constructor
    (SQLiteVectorDatabase as jest.Mock).mockImplementation(() => mockDatabaseService);
    
    // Mock the vector search service constructor
    (SQLiteVectorSearchService as jest.Mock).mockImplementation(() => mockVectorSearchService);

    ragModule = new RAGModule();
    
    // Mock initialization
    ragModule['initialized'] = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('save', () => {
    const validSaveRequest = {
      id: 1,
      text: 'This is a test text',
      tablename: 'test_table'
    };

    it('should save vector successfully', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockEmbeddingService.embed.mockResolvedValue(mockVector);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);

      const result = await ragModule.save(validSaveRequest);

      expect(result).toBe(true);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('This is a test text');
      expect(mockDatabaseService.createTableIfNotExists).toHaveBeenCalledWith('test_table');
      expect(mockDatabaseService.insertVector).toHaveBeenCalledWith('test_table', 1, mockVector);
    });

    it('should throw RAGError when not initialized', async () => {
      ragModule['initialized'] = false;

      await expect(ragModule.save(validSaveRequest))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty text', async () => {
      const invalidRequest = { ...validSaveRequest, text: '' };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for whitespace-only text', async () => {
      const invalidRequest = { ...validSaveRequest, text: '   ' };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for negative ID', async () => {
      const invalidRequest = { ...validSaveRequest, id: -1 };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('ID must be a non-negative integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for non-integer ID', async () => {
      const invalidRequest = { ...validSaveRequest, id: 1.5 };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('ID must be a non-negative integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty table name', async () => {
      const invalidRequest = { ...validSaveRequest, tablename: '' };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for invalid table name format', async () => {
      const invalidRequest = { ...validSaveRequest, tablename: 'invalid-table!' };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for table name starting with number', async () => {
      const invalidRequest = { ...validSaveRequest, tablename: '1invalid' };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for table name too long', async () => {
      const invalidRequest = { ...validSaveRequest, tablename: 'a'.repeat(65) };

      await expect(ragModule.save(invalidRequest))
        .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
    });

    it('should handle embedding service errors', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('Embedding failed'));

      await expect(ragModule.save(validSaveRequest))
        .rejects.toThrow(RAGError);
    });

    it('should handle database table creation errors', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockEmbeddingService.embed.mockResolvedValue(mockVector);
      mockDatabaseService.createTableIfNotExists.mockRejectedValue(new Error('Table creation failed'));

      await expect(ragModule.save(validSaveRequest))
        .rejects.toThrow(RAGError);
    });

    it('should handle vector insertion errors', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockEmbeddingService.embed.mockResolvedValue(mockVector);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockRejectedValue(new Error('Insertion failed'));

      await expect(ragModule.save(validSaveRequest))
        .rejects.toThrow(RAGError);
    });

    it('should return false when vector insertion fails', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockEmbeddingService.embed.mockResolvedValue(mockVector);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(false);

      const result = await ragModule.save(validSaveRequest);

      expect(result).toBe(false);
    });

    it('should propagate RAGError from embedding service', async () => {
      const ragError = new RAGError('Embedding failed', ErrorCodes.EMBEDDING_FAILED);
      mockEmbeddingService.embed.mockRejectedValue(ragError);

      await expect(ragModule.save(validSaveRequest))
        .rejects.toThrow(ragError);
    });

    it('should accept valid table names with underscores and hyphens', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockEmbeddingService.embed.mockResolvedValue(mockVector);
      mockDatabaseService.createTableIfNotExists.mockResolvedValue();
      mockDatabaseService.insertVector.mockResolvedValue(true);

      const validRequest1 = { ...validSaveRequest, tablename: 'valid_table_name' };
      const validRequest2 = { ...validSaveRequest, tablename: 'valid-table-name' };
      const validRequest3 = { ...validSaveRequest, tablename: 'validTableName123' };

      await expect(ragModule.save(validRequest1)).resolves.toBe(true);
      await expect(ragModule.save(validRequest2)).resolves.toBe(true);
      await expect(ragModule.save(validRequest3)).resolves.toBe(true);
    });
  });

  describe('search', () => {
    const validSearchRequest = {
      text: 'search query text',
      tablename: 'test_table',
      qty: 5
    };

    it('should search vectors successfully', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      const mockResults = [1, 3, 5, 2];
      
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockResolvedValue(mockResults);

      const result = await ragModule.search(validSearchRequest);

      expect(result).toEqual(mockResults);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('search query text');
      expect(mockVectorSearchService.search).toHaveBeenCalledWith(
        'test_table',
        mockQueryVector,
        5,
        mockDatabaseService
      );
    });

    it('should return empty array when no results found', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockResolvedValue([]);

      const result = await ragModule.search(validSearchRequest);

      expect(result).toEqual([]);
    });

    it('should throw RAGError when not initialized', async () => {
      ragModule['initialized'] = false;

      await expect(ragModule.search(validSearchRequest))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty search text', async () => {
      const invalidRequest = { ...validSearchRequest, text: '' };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Search text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for whitespace-only search text', async () => {
      const invalidRequest = { ...validSearchRequest, text: '   ' };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Search text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty table name', async () => {
      const invalidRequest = { ...validSearchRequest, tablename: '' };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for invalid table name format', async () => {
      const invalidRequest = { ...validSearchRequest, tablename: 'invalid!' };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for zero quantity', async () => {
      const invalidRequest = { ...validSearchRequest, qty: 0 };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Quantity must be a positive integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for negative quantity', async () => {
      const invalidRequest = { ...validSearchRequest, qty: -1 };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Quantity must be a positive integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for non-integer quantity', async () => {
      const invalidRequest = { ...validSearchRequest, qty: 5.5 };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Quantity must be a positive integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for quantity exceeding maximum', async () => {
      const invalidRequest = { ...validSearchRequest, qty: 1001 };

      await expect(ragModule.search(invalidRequest))
        .rejects.toThrow(new RAGError('Quantity cannot exceed 1000 results', ErrorCodes.INVALID_INPUT));
    });

    it('should handle embedding service errors', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('Embedding failed'));

      await expect(ragModule.search(validSearchRequest))
        .rejects.toThrow(RAGError);
    });

    it('should handle vector search service errors', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockRejectedValue(new Error('Search failed'));

      await expect(ragModule.search(validSearchRequest))
        .rejects.toThrow(RAGError);
    });

    it('should propagate RAGError from embedding service', async () => {
      const ragError = new RAGError('Embedding failed', ErrorCodes.EMBEDDING_FAILED);
      mockEmbeddingService.embed.mockRejectedValue(ragError);

      await expect(ragModule.search(validSearchRequest))
        .rejects.toThrow(ragError);
    });

    it('should propagate RAGError from vector search service', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      const ragError = new RAGError('Search failed', ErrorCodes.SEARCH_FAILED);
      
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockRejectedValue(ragError);

      await expect(ragModule.search(validSearchRequest))
        .rejects.toThrow(ragError);
    });

    it('should accept valid table names with underscores and hyphens', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      const mockResults = [1, 2, 3];
      
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockResolvedValue(mockResults);

      const validRequest1 = { ...validSearchRequest, tablename: 'valid_table_name' };
      const validRequest2 = { ...validSearchRequest, tablename: 'valid-table-name' };
      const validRequest3 = { ...validSearchRequest, tablename: 'validTableName123' };

      await expect(ragModule.search(validRequest1)).resolves.toEqual(mockResults);
      await expect(ragModule.search(validRequest2)).resolves.toEqual(mockResults);
      await expect(ragModule.search(validRequest3)).resolves.toEqual(mockResults);
    });

    it('should handle single result correctly', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      const mockResults = [42];
      
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockResolvedValue(mockResults);

      const singleResultRequest = { ...validSearchRequest, qty: 1 };
      const result = await ragModule.search(singleResultRequest);

      expect(result).toEqual(mockResults);
    });

    it('should handle maximum quantity correctly', async () => {
      const mockQueryVector = [0.1, 0.2, 0.3];
      const mockResults = Array.from({ length: 1000 }, (_, i) => i + 1);
      
      mockEmbeddingService.embed.mockResolvedValue(mockQueryVector);
      mockVectorSearchService.search.mockResolvedValue(mockResults);

      const maxQuantityRequest = { ...validSearchRequest, qty: 1000 };
      const result = await ragModule.search(maxQuantityRequest);

      expect(result).toEqual(mockResults);
    });
  });

  describe('embed', () => {
    const validEmbedRequest = {
      text: 'This is a test text for embedding'
    };

    it('should generate embedding successfully', async () => {
      const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockEmbeddingService.embed.mockResolvedValue(mockVector);

      const result = await ragModule.embed(validEmbedRequest);

      expect(result).toEqual(mockVector);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('This is a test text for embedding');
      
      // Ensure no database interaction occurs
      expect(mockDatabaseService.createTableIfNotExists).not.toHaveBeenCalled();
      expect(mockDatabaseService.insertVector).not.toHaveBeenCalled();
      expect(mockVectorSearchService.search).not.toHaveBeenCalled();
    });

    it('should throw RAGError when not initialized', async () => {
      ragModule['initialized'] = false;

      await expect(ragModule.embed(validEmbedRequest))
        .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty text', async () => {
      const invalidRequest = { text: '' };

      await expect(ragModule.embed(invalidRequest))
        .rejects.toThrow(new RAGError('text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for whitespace-only text', async () => {
      const invalidRequest = { text: '   ' };

      await expect(ragModule.embed(invalidRequest))
        .rejects.toThrow(new RAGError('text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should handle embedding service errors', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('Model failed'));

      await expect(ragModule.embed(validEmbedRequest))
        .rejects.toThrow(RAGError);
    });

    it('should propagate RAGError from embedding service', async () => {
      const ragError = new RAGError('Model not loaded', ErrorCodes.MODEL_LOAD_FAILED);
      mockEmbeddingService.embed.mockRejectedValue(ragError);

      await expect(ragModule.embed(validEmbedRequest))
        .rejects.toThrow(ragError);
    });

    it('should handle long text input', async () => {
      const longText = 'This is a very long text '.repeat(100);
      const mockVector = Array.from({ length: 768 }, (_, i) => i * 0.001);
      
      mockEmbeddingService.embed.mockResolvedValue(mockVector);

      const longTextRequest = { text: longText };
      const result = await ragModule.embed(longTextRequest);

      expect(result).toEqual(mockVector);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(longText.trim());
    });

    it('should handle special characters in text', async () => {
      const specialText = 'Text with special chars: @#$%^&*()[]{}|;:,.<>?';
      const mockVector = [0.1, 0.2, 0.3];
      
      mockEmbeddingService.embed.mockResolvedValue(mockVector);

      const specialTextRequest = { text: specialText };
      const result = await ragModule.embed(specialTextRequest);

      expect(result).toEqual(mockVector);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(specialText);
    });

    it('should handle unicode text', async () => {
      const unicodeText = 'Unicode text: 你好世界 🌍 café naïve résumé';
      const mockVector = [0.1, 0.2, 0.3];
      
      mockEmbeddingService.embed.mockResolvedValue(mockVector);

      const unicodeTextRequest = { text: unicodeText };
      const result = await ragModule.embed(unicodeTextRequest);

      expect(result).toEqual(mockVector);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(unicodeText);
    });

    it('should return consistent vector dimensions', async () => {
      const mockVector = Array.from({ length: 768 }, (_, i) => Math.random());
      mockEmbeddingService.embed.mockResolvedValue(mockVector);

      const result = await ragModule.embed(validEmbedRequest);

      expect(result).toHaveLength(768);
      expect(result.every(val => typeof val === 'number')).toBe(true);
    });
  });

  describe('configuration and initialization', () => {
    it('should use default configuration when no config provided', () => {
      const defaultRagModule = new RAGModule();
      
      expect(defaultRagModule['config']).toEqual({
        modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
        databasePath: './rag.db',
        logLevel: 'info'
      });
    });

    it('should use provided configuration', () => {
      const customConfig = {
        modelPath: './custom-model.gguf',
        databasePath: './custom.db',
        logLevel: 'debug' as const
      };
      
      const customRagModule = new RAGModule(customConfig);
      
      expect(customRagModule['config']).toEqual(customConfig);
    });

    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        modelPath: './custom-model.gguf'
      };
      
      const ragModuleWithPartialConfig = new RAGModule(partialConfig);
      
      expect(ragModuleWithPartialConfig['config']).toEqual({
        modelPath: './custom-model.gguf',
        databasePath: './rag.db',
        logLevel: 'info'
      });
    });

    describe('initialize', () => {
      beforeEach(() => {
        ragModule['initialized'] = false;
      });

      it('should initialize successfully', async () => {
        mockEmbeddingService.initialize.mockResolvedValue();
        mockDatabaseService.initialize.mockResolvedValue();

        await ragModule.initialize();

        expect(mockEmbeddingService.initialize).toHaveBeenCalledWith('./nomic-embed-text-v1.5.Q5_K_M.gguf');
        expect(mockDatabaseService.initialize).toHaveBeenCalledWith('./rag.db');
        expect(ragModule['initialized']).toBe(true);
      });

      it('should not reinitialize if already initialized', async () => {
        ragModule['initialized'] = true;
        mockEmbeddingService.initialize.mockClear();
        mockDatabaseService.initialize.mockClear();

        await ragModule.initialize();

        expect(mockEmbeddingService.initialize).not.toHaveBeenCalled();
        expect(mockDatabaseService.initialize).not.toHaveBeenCalled();
      });

      it('should throw RAGError when embedding service initialization fails', async () => {
        mockEmbeddingService.initialize.mockRejectedValue(new Error('Model load failed'));

        await expect(ragModule.initialize())
          .rejects.toThrow(RAGError);
        
        expect(ragModule['initialized']).toBe(false);
      });

      it('should throw RAGError when database service initialization fails', async () => {
        mockEmbeddingService.initialize.mockResolvedValue();
        mockDatabaseService.initialize.mockRejectedValue(new Error('Database connection failed'));

        await expect(ragModule.initialize())
          .rejects.toThrow(RAGError);
        
        expect(ragModule['initialized']).toBe(false);
      });

      it('should propagate RAGError from embedding service', async () => {
        const ragError = new RAGError('Model not found', ErrorCodes.MODEL_LOAD_FAILED);
        mockEmbeddingService.initialize.mockRejectedValue(ragError);

        await expect(ragModule.initialize())
          .rejects.toThrow(ragError);
      });

      it('should propagate RAGError from database service', async () => {
        mockEmbeddingService.initialize.mockResolvedValue();
        const ragError = new RAGError('Database error', ErrorCodes.DATABASE_CONNECTION_FAILED);
        mockDatabaseService.initialize.mockRejectedValue(ragError);

        await expect(ragModule.initialize())
          .rejects.toThrow(ragError);
      });
    });

    describe('close', () => {
      beforeEach(() => {
        ragModule['initialized'] = true;
      });

      it('should close successfully', async () => {
        mockEmbeddingService.close.mockResolvedValue();
        mockDatabaseService.close.mockResolvedValue();

        await ragModule.close();

        expect(mockEmbeddingService.close).toHaveBeenCalled();
        expect(mockDatabaseService.close).toHaveBeenCalled();
        expect(ragModule['initialized']).toBe(false);
      });

      it('should not close if already closed', async () => {
        ragModule['initialized'] = false;
        mockEmbeddingService.close.mockClear();
        mockDatabaseService.close.mockClear();

        await ragModule.close();

        expect(mockEmbeddingService.close).not.toHaveBeenCalled();
        expect(mockDatabaseService.close).not.toHaveBeenCalled();
      });

      it('should throw RAGError when embedding service close fails', async () => {
        mockEmbeddingService.close.mockRejectedValue(new Error('Close failed'));

        await expect(ragModule.close())
          .rejects.toThrow(RAGError);
      });

      it('should throw RAGError when database service close fails', async () => {
        mockEmbeddingService.close.mockResolvedValue();
        mockDatabaseService.close.mockRejectedValue(new Error('Database close failed'));

        await expect(ragModule.close())
          .rejects.toThrow(RAGError);
      });

      it('should propagate RAGError from embedding service', async () => {
        const ragError = new RAGError('Model disposal failed', ErrorCodes.MODEL_LOAD_FAILED);
        mockEmbeddingService.close.mockRejectedValue(ragError);

        await expect(ragModule.close())
          .rejects.toThrow(ragError);
      });

      it('should propagate RAGError from database service', async () => {
        mockEmbeddingService.close.mockResolvedValue();
        const ragError = new RAGError('Database close error', ErrorCodes.DATABASE_CONNECTION_FAILED);
        mockDatabaseService.close.mockRejectedValue(ragError);

        await expect(ragModule.close())
          .rejects.toThrow(ragError);
      });
    });

    describe('initialization state management', () => {
      it('should require initialization before embed', async () => {
        ragModule['initialized'] = false;

        await expect(ragModule.embed({ text: 'test' }))
          .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
      });

      it('should require initialization before save', async () => {
        ragModule['initialized'] = false;

        await expect(ragModule.save({ id: 1, text: 'test', tablename: 'test_table' }))
          .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
      });

      it('should require initialization before search', async () => {
        ragModule['initialized'] = false;

        await expect(ragModule.search({ text: 'test', tablename: 'test_table', qty: 5 }))
          .rejects.toThrow(new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT));
      });
    });
  });
});
import { SQLiteVectorSearchService } from '../vectorSearch';
import { DatabaseService } from '../../types';
import { RAGError, ErrorCodes } from '../../errors';

describe('SQLiteVectorSearchService', () => {
  let vectorSearchService: SQLiteVectorSearchService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    vectorSearchService = new SQLiteVectorSearchService();
    
    mockDatabaseService = {
      initialize: jest.fn(),
      createTableIfNotExists: jest.fn(),
      insertVector: jest.fn(),
      searchSimilar: jest.fn(),
      close: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    const validTablename = 'test_table';
    const validQueryVector = [0.1, 0.2, 0.3, 0.4];
    const validLimit = 5;

    it('should perform search successfully', async () => {
      const mockResults = [1, 3, 5, 2];
      mockDatabaseService.searchSimilar.mockResolvedValue(mockResults);

      const result = await vectorSearchService.search(
        validTablename,
        validQueryVector,
        validLimit,
        mockDatabaseService
      );

      expect(result).toEqual(mockResults);
      expect(mockDatabaseService.searchSimilar).toHaveBeenCalledWith(
        validTablename,
        validQueryVector,
        validLimit
      );
    });

    it('should return empty array when no results found', async () => {
      mockDatabaseService.searchSimilar.mockResolvedValue([]);

      const result = await vectorSearchService.search(
        validTablename,
        validQueryVector,
        validLimit,
        mockDatabaseService
      );

      expect(result).toEqual([]);
    });

    it('should return fewer results when limit exceeds available data', async () => {
      const mockResults = [1, 2];
      mockDatabaseService.searchSimilar.mockResolvedValue(mockResults);

      const result = await vectorSearchService.search(
        validTablename,
        validQueryVector,
        10, // Requesting 10 but only 2 available
        mockDatabaseService
      );

      expect(result).toEqual(mockResults);
    });

    describe('input validation', () => {
      it('should throw RAGError for empty table name', async () => {
        await expect(vectorSearchService.search('', validQueryVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for whitespace-only table name', async () => {
        await expect(vectorSearchService.search('   ', validQueryVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for invalid table name format', async () => {
        await expect(vectorSearchService.search('invalid!', validQueryVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for table name starting with number', async () => {
        await expect(vectorSearchService.search('1invalid', validQueryVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for table name too long', async () => {
        const longTableName = 'a'.repeat(65);
        await expect(vectorSearchService.search(longTableName, validQueryVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for empty query vector', async () => {
        await expect(vectorSearchService.search(validTablename, [], validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Query vector must be a non-empty array', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for non-array query vector', async () => {
        await expect(vectorSearchService.search(validTablename, 'not-array' as any, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Query vector must be a non-empty array', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for query vector with invalid numbers', async () => {
        const invalidVector = [0.1, NaN, 0.3];
        await expect(vectorSearchService.search(validTablename, invalidVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Query vector must contain only valid numbers', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for query vector with non-numbers', async () => {
        const invalidVector = [0.1, 'string' as any, 0.3];
        await expect(vectorSearchService.search(validTablename, invalidVector, validLimit, mockDatabaseService))
          .rejects.toThrow(new RAGError('Query vector must contain only valid numbers', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for zero limit', async () => {
        await expect(vectorSearchService.search(validTablename, validQueryVector, 0, mockDatabaseService))
          .rejects.toThrow(new RAGError('Limit must be a positive integer', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for negative limit', async () => {
        await expect(vectorSearchService.search(validTablename, validQueryVector, -1, mockDatabaseService))
          .rejects.toThrow(new RAGError('Limit must be a positive integer', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for non-integer limit', async () => {
        await expect(vectorSearchService.search(validTablename, validQueryVector, 5.5, mockDatabaseService))
          .rejects.toThrow(new RAGError('Limit must be a positive integer', ErrorCodes.INVALID_INPUT));
      });

      it('should throw RAGError for limit exceeding maximum', async () => {
        await expect(vectorSearchService.search(validTablename, validQueryVector, 1001, mockDatabaseService))
          .rejects.toThrow(new RAGError('Limit cannot exceed 1000 results', ErrorCodes.INVALID_INPUT));
      });
    });

    it('should handle database service errors', async () => {
      mockDatabaseService.searchSimilar.mockRejectedValue(new Error('Database error'));

      await expect(vectorSearchService.search(validTablename, validQueryVector, validLimit, mockDatabaseService))
        .rejects.toThrow(RAGError);
    });

    it('should propagate RAGError from database service', async () => {
      const ragError = new RAGError('Database search failed', ErrorCodes.SEARCH_FAILED);
      mockDatabaseService.searchSimilar.mockRejectedValue(ragError);

      await expect(vectorSearchService.search(validTablename, validQueryVector, validLimit, mockDatabaseService))
        .rejects.toThrow(ragError);
    });

    it('should accept valid table names with underscores and hyphens', async () => {
      const mockResults = [1, 2, 3];
      mockDatabaseService.searchSimilar.mockResolvedValue(mockResults);

      const validTableNames = ['valid_table', 'valid-table', 'validTable123'];

      for (const tablename of validTableNames) {
        const result = await vectorSearchService.search(
          tablename,
          validQueryVector,
          validLimit,
          mockDatabaseService
        );
        expect(result).toEqual(mockResults);
      }
    });

    it('should handle edge case with single result', async () => {
      const mockResults = [42];
      mockDatabaseService.searchSimilar.mockResolvedValue(mockResults);

      const result = await vectorSearchService.search(
        validTablename,
        validQueryVector,
        1,
        mockDatabaseService
      );

      expect(result).toEqual(mockResults);
    });

    it('should handle large valid query vectors', async () => {
      const largeVector = Array.from({ length: 768 }, (_, i) => i * 0.001); // Typical embedding size
      const mockResults = [1, 2, 3];
      mockDatabaseService.searchSimilar.mockResolvedValue(mockResults);

      const result = await vectorSearchService.search(
        validTablename,
        largeVector,
        validLimit,
        mockDatabaseService
      );

      expect(result).toEqual(mockResults);
    });
  });
});
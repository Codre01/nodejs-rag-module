import { SQLiteVectorDatabase } from '../database';
import { RAGError, ErrorCodes } from '../../errors';
import * as sqlite3 from 'sqlite3';
import * as sqliteVec from 'sqlite-vec';

// Mock sqlite3 and sqlite-vec
jest.mock('sqlite3');
jest.mock('sqlite-vec');

describe('SQLiteVectorDatabase', () => {
  let database: SQLiteVectorDatabase;
  let mockDb: any;

  beforeEach(() => {
    database = new SQLiteVectorDatabase();
    
    mockDb = {
      loadExtension: jest.fn(),
      run: jest.fn(),
      all: jest.fn(),
      close: jest.fn(),
    };

    (sqlite3.Database as jest.MockedClass<typeof sqlite3.Database>).mockImplementation((path, callback: any) => {
      // Simulate successful connection
      setTimeout(() => callback(null), 0);
      return mockDb;
    });

    (sqliteVec.getLoadablePath as jest.Mock).mockReturnValue('/path/to/sqlite-vec.so');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid database path', async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(null);
      });

      await database.initialize('./test.db');
      
      expect(sqlite3.Database).toHaveBeenCalledWith('./test.db', expect.any(Function));
      expect(mockDb.loadExtension).toHaveBeenCalled();
    });

    it('should throw RAGError when database connection fails', async () => {
      (sqlite3.Database as jest.MockedClass<typeof sqlite3.Database>).mockImplementation((path, callback: any) => {
        setTimeout(() => callback(new Error('Connection failed')), 0);
        return mockDb;
      });

      await expect(database.initialize('./invalid.db'))
        .rejects.toThrow(RAGError);
    });

    it('should throw RAGError when sqlite-vec extension loading fails', async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(new Error('Extension load failed'));
      });

      await expect(database.initialize('./test.db'))
        .rejects.toThrow(RAGError);
    });

    it('should not reinitialize if already initialized with same path', async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(null);
      });

      await database.initialize('./test.db');
      (sqlite3.Database as jest.MockedClass<typeof sqlite3.Database>).mockClear();
      
      await database.initialize('./test.db');
      
      expect(sqlite3.Database).not.toHaveBeenCalled();
    });
  });

  describe('createTableIfNotExists', () => {
    beforeEach(async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(null);
      });
      await database.initialize('./test.db');
    });

    it('should create table and index successfully', async () => {
      mockDb.run.mockImplementation((sql, callback) => {
        callback(null);
      });

      await database.createTableIfNotExists('test_table');

      expect(mockDb.run).toHaveBeenCalledTimes(2); // Table creation + index creation
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "test_table"'),
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS "idx_test_table_vector"'),
        expect.any(Function)
      );
    });

    it('should throw RAGError for invalid table name', async () => {
      await expect(database.createTableIfNotExists('invalid-table-name!'))
        .rejects.toThrow(new RAGError('Invalid table name', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError when table creation fails', async () => {
      mockDb.run.mockImplementation((sql, callback) => {
        callback(new Error('Table creation failed'));
      });

      await expect(database.createTableIfNotExists('test_table'))
        .rejects.toThrow(RAGError);
    });

    it('should throw RAGError when not initialized', async () => {
      const uninitializedDb = new SQLiteVectorDatabase();
      
      await expect(uninitializedDb.createTableIfNotExists('test_table'))
        .rejects.toThrow(new RAGError('Database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED));
    });
  });

  describe('insertVector', () => {
    beforeEach(async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(null);
      });
      await database.initialize('./test.db');
    });

    it('should insert vector successfully', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await database.insertVector('test_table', 1, [0.1, 0.2, 0.3]);

      expect(result).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO "test_table"'),
        expect.arrayContaining([1, expect.any(Buffer)]),
        expect.any(Function)
      );
    });

    it('should throw RAGError for invalid table name', async () => {
      await expect(database.insertVector('invalid!', 1, [0.1, 0.2]))
        .rejects.toThrow(new RAGError('Invalid table name', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError when insertion fails', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Insertion failed'));
      });

      await expect(database.insertVector('test_table', 1, [0.1, 0.2]))
        .rejects.toThrow(RAGError);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(null);
      });
      await database.initialize('./test.db');
    });

    it('should search similar vectors successfully', async () => {
      const mockResults = [
        { id: 1, distance: 0.1 },
        { id: 3, distance: 0.2 },
        { id: 2, distance: 0.3 }
      ];
      
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockResults);
      });

      const result = await database.searchSimilar('test_table', [0.1, 0.2, 0.3], 3);

      expect(result).toEqual([1, 3, 2]);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('vec_distance_cosine'),
        expect.arrayContaining([expect.any(Buffer), 3]),
        expect.any(Function)
      );
    });

    it('should return empty array when no results found', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await database.searchSimilar('test_table', [0.1, 0.2], 5);

      expect(result).toEqual([]);
    });

    it('should throw RAGError for invalid table name', async () => {
      await expect(database.searchSimilar('invalid!', [0.1, 0.2], 5))
        .rejects.toThrow(new RAGError('Invalid table name', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError when search fails', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Search failed'));
      });

      await expect(database.searchSimilar('test_table', [0.1, 0.2], 5))
        .rejects.toThrow(RAGError);
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      mockDb.loadExtension.mockImplementation((path, callback) => {
        callback(null);
      });
      await database.initialize('./test.db');
    });

    it('should close database successfully', async () => {
      mockDb.close.mockImplementation((callback) => {
        callback(null);
      });

      await database.close();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      mockDb.close.mockImplementation((callback) => {
        callback(new Error('Close failed'));
      });

      await expect(database.close()).rejects.toThrow(RAGError);
    });
  });
});
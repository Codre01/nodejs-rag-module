import sqlite3 from 'sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { DatabaseService } from '../types/index.js';
import { RAGError, ErrorCodes } from '../errors/index.js';

export class SQLiteVectorDatabase implements DatabaseService {
  private db: sqlite3.Database | null = null;
  private databasePath: string = '';
  private initialized: boolean = false;

  async initialize(databasePath: string): Promise<void> {
    if (this.initialized && this.databasePath === databasePath) {
      return; // Already initialized with the same database
    }

    try {
      this.databasePath = databasePath;
      
      // Create database connection
      await new Promise<void>((resolve, reject) => {
        this.db = new sqlite3.Database(databasePath, (err) => {
          if (err) {
            reject(new RAGError(
              `Failed to connect to database: ${err.message}`,
              ErrorCodes.DATABASE_CONNECTION_FAILED,
              err
            ));
          } else {
            resolve();
          }
        });
      });

      // Load sqlite-vec extension
      await this.loadVectorExtension();
      
      this.initialized = true;
    } catch (error) {
      throw new RAGError(
        `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.DATABASE_CONNECTION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async loadVectorExtension(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Enable loading extensions
      this.db.loadExtension(sqliteVec.getLoadablePath(), (err) => {
        if (err) {
          reject(new RAGError(
            `Failed to load sqlite-vec extension: ${err.message}`,
            ErrorCodes.DATABASE_CONNECTION_FAILED,
            err
          ));
        } else {
          resolve();
        }
      });
    });
  }

  async createTableIfNotExists(tablename: string): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new RAGError('Database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
    }

    // Validate table name to prevent SQL injection
    if (!this.isValidTableName(tablename)) {
      throw new RAGError('Invalid table name', ErrorCodes.INVALID_INPUT);
    }

    return new Promise((resolve, reject) => {
      // Create a virtual table using vec0 for vector storage and search
      const createTableSQL = `
        CREATE VIRTUAL TABLE IF NOT EXISTS "${tablename}" 
        USING vec0(
          id INTEGER PRIMARY KEY,
          vector FLOAT[768]
        )
      `;

      this.db!.run(createTableSQL, (err) => {
        if (err) {
          reject(new RAGError(
            `Failed to create table ${tablename}: ${err.message}`,
            ErrorCodes.TABLE_CREATION_FAILED,
            err
          ));
        } else {
          resolve();
        }
      });
    });
  }

  async insertVector(tablename: string, id: number, vector: number[]): Promise<boolean> {
    if (!this.initialized || !this.db) {
      throw new RAGError('Database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
    }

    if (!this.isValidTableName(tablename)) {
      throw new RAGError('Invalid table name', ErrorCodes.INVALID_INPUT);
    }

    return new Promise((resolve, reject) => {
      // Convert vector to JSON string for vec0 virtual table
      const vectorJson = JSON.stringify(vector);
      
      const insertSQL = `
        INSERT OR REPLACE INTO "${tablename}" (id, vector) 
        VALUES (?, ?)
      `;

      this.db!.run(insertSQL, [id, vectorJson], function(err) {
        if (err) {
          reject(new RAGError(
            `Failed to insert vector for id ${id} in table ${tablename}: ${err.message}`,
            ErrorCodes.VECTOR_SAVE_FAILED,
            err
          ));
        } else {
          resolve(true);
        }
      });
    });
  }

  async searchSimilar(tablename: string, queryVector: number[], limit: number): Promise<number[]> {
    if (!this.initialized || !this.db) {
      throw new RAGError('Database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
    }

    if (!this.isValidTableName(tablename)) {
      throw new RAGError('Invalid table name', ErrorCodes.INVALID_INPUT);
    }

    return new Promise((resolve, reject) => {
      // Convert query vector to JSON string for vec0 virtual table
      const queryVectorJson = JSON.stringify(queryVector);
      
      // Use sqlite-vec similarity search with vec0 virtual table
      const searchSQL = `
        SELECT 
          id,
          vec_distance_cosine(vector, ?) as distance
        FROM "${tablename}"
        ORDER BY distance ASC
        LIMIT ?
      `;

      this.db!.all(searchSQL, [queryVectorJson, limit], (err, rows: any[]) => {
        if (err) {
          reject(new RAGError(
            `Failed to search similar vectors in table ${tablename}: ${err.message}`,
            ErrorCodes.SEARCH_FAILED,
            err
          ));
        } else {
          // Extract IDs from results
          const ids = rows.map(row => row.id);
          resolve(ids);
        }
      });
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(new RAGError(
              `Failed to close database: ${err.message}`,
              ErrorCodes.DATABASE_CONNECTION_FAILED,
              err
            ));
          } else {
            this.db = null;
            this.initialized = false;
            resolve();
          }
        });
      });
    }
  }

  private isValidTableName(tablename: string): boolean {
    // Basic validation to prevent SQL injection
    // Allow alphanumeric characters, underscores, and hyphens
    const validTableNameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    return validTableNameRegex.test(tablename) && tablename.length <= 64;
  }
}
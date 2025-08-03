import { VectorSearchService, DatabaseService } from '../types/index.js';
import { RAGError, ErrorCodes } from '../errors/index.js';

export class SQLiteVectorSearchService implements VectorSearchService {
  async search(
    tablename: string, 
    queryVector: number[], 
    limit: number, 
    dbService: DatabaseService
  ): Promise<number[]> {
    try {
      // Validate inputs
      this.validateSearchInputs(tablename, queryVector, limit);

      // Delegate to database service for actual search
      const results = await dbService.searchSimilar(tablename, queryVector, limit);
      
      return results;
    } catch (error) {
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.SEARCH_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  private validateSearchInputs(tablename: string, queryVector: number[], limit: number): void {
    // Validate table name
    if (!tablename || tablename.trim().length === 0) {
      throw new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT);
    }

    const validTableNameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!validTableNameRegex.test(tablename) || tablename.length > 64) {
      throw new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT);
    }

    // Validate query vector
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new RAGError('Query vector must be a non-empty array', ErrorCodes.INVALID_INPUT);
    }

    if (!queryVector.every(val => typeof val === 'number' && !isNaN(val))) {
      throw new RAGError('Query vector must contain only valid numbers', ErrorCodes.INVALID_INPUT);
    }

    // Validate limit
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RAGError('Limit must be a positive integer', ErrorCodes.INVALID_INPUT);
    }

    if (limit > 1000) {
      throw new RAGError('Limit cannot exceed 1000 results', ErrorCodes.INVALID_INPUT);
    }
  }
}
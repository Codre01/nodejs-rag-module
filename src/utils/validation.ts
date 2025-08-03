import { RAGError, ErrorCodes } from '../errors/index.js';

/**
 * Utility class for input validation and sanitization
 */
export class InputValidator {
  private static readonly TABLE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  private static readonly MAX_TABLE_NAME_LENGTH = 64;
  private static readonly MAX_TEXT_LENGTH = 1000000; // 1MB of text
  private static readonly MAX_SEARCH_QUANTITY = 1000;
  private static readonly MIN_SEARCH_QUANTITY = 1;

  /**
   * Validates and sanitizes text input
   * @param text - The text to validate
   * @param fieldName - Name of the field for error messages
   * @returns The sanitized text
   * @throws {RAGError} When text is invalid
   */
  static validateText(text: string, fieldName: string = 'text'): string {
    if (typeof text !== 'string') {
      throw new RAGError(`${fieldName} must be a string`, ErrorCodes.INVALID_INPUT);
    }

    if (text.length === 0) {
      throw new RAGError(`${fieldName} cannot be empty`, ErrorCodes.INVALID_INPUT);
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new RAGError(`${fieldName} cannot be empty`, ErrorCodes.INVALID_INPUT);
    }

    if (trimmedText.length > this.MAX_TEXT_LENGTH) {
      throw new RAGError(
        `${fieldName} exceeds maximum length of ${this.MAX_TEXT_LENGTH} characters`,
        ErrorCodes.INVALID_INPUT
      );
    }

    return trimmedText;
  }

  /**
   * Validates and sanitizes table name
   * @param tablename - The table name to validate
   * @returns The sanitized table name
   * @throws {RAGError} When table name is invalid
   */
  static validateTableName(tablename: string): string {
    if (typeof tablename !== 'string') {
      throw new RAGError('Table name must be a string', ErrorCodes.INVALID_INPUT);
    }

    if (tablename.length === 0) {
      throw new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT);
    }

    const trimmedTableName = tablename.trim();
    if (trimmedTableName.length === 0) {
      throw new RAGError('Table name cannot be empty or whitespace only', ErrorCodes.INVALID_INPUT);
    }

    if (trimmedTableName.length > this.MAX_TABLE_NAME_LENGTH) {
      throw new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT);
    }

    if (!this.TABLE_NAME_REGEX.test(trimmedTableName)) {
      throw new RAGError('Invalid table name format', ErrorCodes.INVALID_INPUT);
    }

    // Check for SQL reserved words (basic protection)
    const reservedWords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'INDEX',
      'TABLE', 'DATABASE', 'SCHEMA', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION',
      'UNION', 'JOIN', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'LIMIT'
    ];

    if (reservedWords.includes(trimmedTableName.toUpperCase())) {
      throw new RAGError(
        `Table name '${trimmedTableName}' is a reserved SQL keyword`,
        ErrorCodes.INVALID_INPUT
      );
    }

    return trimmedTableName;
  }

  /**
   * Validates ID parameter
   * @param id - The ID to validate
   * @returns The validated ID
   * @throws {RAGError} When ID is invalid
   */
  static validateId(id: number): number {
    if (typeof id !== 'number') {
      throw new RAGError('ID must be a number', ErrorCodes.INVALID_INPUT);
    }

    if (!Number.isInteger(id)) {
      throw new RAGError('ID must be a non-negative integer', ErrorCodes.INVALID_INPUT);
    }

    if (id < 0) {
      throw new RAGError('ID must be a non-negative integer', ErrorCodes.INVALID_INPUT);
    }

    if (id > Number.MAX_SAFE_INTEGER) {
      throw new RAGError('ID exceeds maximum safe integer value', ErrorCodes.INVALID_INPUT);
    }

    return id;
  }

  /**
   * Validates search quantity parameter
   * @param qty - The quantity to validate
   * @returns The validated quantity
   * @throws {RAGError} When quantity is invalid
   */
  static validateSearchQuantity(qty: number): number {
    if (typeof qty !== 'number') {
      throw new RAGError('Quantity must be a number', ErrorCodes.INVALID_INPUT);
    }

    if (!Number.isInteger(qty)) {
      throw new RAGError('Quantity must be a positive integer', ErrorCodes.INVALID_INPUT);
    }

    if (qty < this.MIN_SEARCH_QUANTITY) {
      throw new RAGError('Quantity must be a positive integer', ErrorCodes.INVALID_INPUT);
    }

    if (qty > this.MAX_SEARCH_QUANTITY) {
      throw new RAGError('Quantity cannot exceed 1000 results', ErrorCodes.INVALID_INPUT);
    }

    return qty;
  }

  /**
   * Validates vector array
   * @param vector - The vector to validate
   * @returns The validated vector
   * @throws {RAGError} When vector is invalid
   */
  static validateVector(vector: number[]): number[] {
    if (!Array.isArray(vector)) {
      throw new RAGError('Vector must be an array', ErrorCodes.INVALID_INPUT);
    }

    if (vector.length === 0) {
      throw new RAGError('Vector cannot be empty', ErrorCodes.INVALID_INPUT);
    }

    if (vector.length > 10000) { // Reasonable upper limit for vector dimensions
      throw new RAGError('Vector dimensions exceed reasonable limit', ErrorCodes.INVALID_INPUT);
    }

    for (let i = 0; i < vector.length; i++) {
      const value = vector[i];
      if (typeof value !== 'number') {
        throw new RAGError(`Vector element at index ${i} must be a number`, ErrorCodes.INVALID_INPUT);
      }

      if (!Number.isFinite(value)) {
        throw new RAGError(`Vector element at index ${i} must be a finite number`, ErrorCodes.INVALID_INPUT);
      }
    }

    return vector;
  }

  /**
   * Sanitizes text by removing potentially harmful characters while preserving content
   * @param text - The text to sanitize
   * @returns The sanitized text
   */
  static sanitizeText(text: string): string {
    // Remove null bytes and other control characters except newlines and tabs
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Validates configuration object
   * @param config - The configuration to validate
   * @returns The validated configuration
   * @throws {RAGError} When configuration is invalid
   */
  static validateConfig(config: any): any {
    if (config === null || config === undefined) {
      return {};
    }

    if (typeof config !== 'object') {
      throw new RAGError('Configuration must be an object', ErrorCodes.INVALID_INPUT);
    }

    const validatedConfig: any = {};

    if (config.modelPath !== undefined) {
      if (typeof config.modelPath !== 'string') {
        throw new RAGError('Model path must be a string', ErrorCodes.INVALID_INPUT);
      }
      if (config.modelPath.trim().length === 0) {
        throw new RAGError('Model path cannot be empty', ErrorCodes.INVALID_INPUT);
      }
      validatedConfig.modelPath = config.modelPath.trim();
    }

    if (config.databasePath !== undefined) {
      if (typeof config.databasePath !== 'string') {
        throw new RAGError('Database path must be a string', ErrorCodes.INVALID_INPUT);
      }
      if (config.databasePath.trim().length === 0) {
        throw new RAGError('Database path cannot be empty', ErrorCodes.INVALID_INPUT);
      }
      validatedConfig.databasePath = config.databasePath.trim();
    }

    if (config.logLevel !== undefined) {
      const validLogLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLogLevels.includes(config.logLevel)) {
        throw new RAGError(
          `Log level must be one of: ${validLogLevels.join(', ')}`,
          ErrorCodes.INVALID_INPUT
        );
      }
      validatedConfig.logLevel = config.logLevel;
    }

    return validatedConfig;
  }
}
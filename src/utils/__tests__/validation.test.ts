import { InputValidator } from '../validation';
import { RAGError, ErrorCodes } from '../../errors';

describe('InputValidator', () => {
  describe('validateText', () => {
    it('should validate and return trimmed text for valid input', () => {
      const result = InputValidator.validateText('  Hello world  ');
      expect(result).toBe('Hello world');
    });

    it('should throw RAGError for non-string input', () => {
      expect(() => InputValidator.validateText(123 as any))
        .toThrow(new RAGError('text must be a string', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty string', () => {
      expect(() => InputValidator.validateText(''))
        .toThrow(new RAGError('text cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for whitespace-only string', () => {
      expect(() => InputValidator.validateText('   '))
        .toThrow(new RAGError('text cannot be empty or whitespace only', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for text exceeding maximum length', () => {
      const longText = 'a'.repeat(1000001);
      expect(() => InputValidator.validateText(longText))
        .toThrow(new RAGError('text exceeds maximum length of 1000000 characters', ErrorCodes.INVALID_INPUT));
    });

    it('should use custom field name in error messages', () => {
      expect(() => InputValidator.validateText('', 'query'))
        .toThrow(new RAGError('query cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should handle unicode text correctly', () => {
      const unicodeText = '你好世界 🌍 café';
      const result = InputValidator.validateText(unicodeText);
      expect(result).toBe(unicodeText);
    });
  });

  describe('validateTableName', () => {
    it('should validate and return trimmed table name for valid input', () => {
      const result = InputValidator.validateTableName('  valid_table_name  ');
      expect(result).toBe('valid_table_name');
    });

    it('should accept valid table names with underscores and hyphens', () => {
      expect(InputValidator.validateTableName('valid_table')).toBe('valid_table');
      expect(InputValidator.validateTableName('valid-table')).toBe('valid-table');
      expect(InputValidator.validateTableName('validTable123')).toBe('validTable123');
    });

    it('should throw RAGError for non-string input', () => {
      expect(() => InputValidator.validateTableName(123 as any))
        .toThrow(new RAGError('Table name must be a string', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty string', () => {
      expect(() => InputValidator.validateTableName(''))
        .toThrow(new RAGError('Table name cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for whitespace-only string', () => {
      expect(() => InputValidator.validateTableName('   '))
        .toThrow(new RAGError('Table name cannot be empty or whitespace only', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for table name exceeding maximum length', () => {
      const longTableName = 'a'.repeat(65);
      expect(() => InputValidator.validateTableName(longTableName))
        .toThrow(new RAGError('Table name exceeds maximum length of 64 characters', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for table name starting with number', () => {
      expect(() => InputValidator.validateTableName('1invalid'))
        .toThrow(new RAGError('Table name must start with a letter and contain only letters, numbers, underscores, and hyphens', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for table name with invalid characters', () => {
      expect(() => InputValidator.validateTableName('invalid!'))
        .toThrow(new RAGError('Table name must start with a letter and contain only letters, numbers, underscores, and hyphens', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for SQL reserved words', () => {
      expect(() => InputValidator.validateTableName('SELECT'))
        .toThrow(new RAGError("Table name 'SELECT' is a reserved SQL keyword", ErrorCodes.INVALID_INPUT));
      
      expect(() => InputValidator.validateTableName('table'))
        .toThrow(new RAGError("Table name 'table' is a reserved SQL keyword", ErrorCodes.INVALID_INPUT));
    });

    it('should be case-insensitive for reserved words', () => {
      expect(() => InputValidator.validateTableName('select'))
        .toThrow(new RAGError("Table name 'select' is a reserved SQL keyword", ErrorCodes.INVALID_INPUT));
    });
  });

  describe('validateId', () => {
    it('should validate and return valid ID', () => {
      expect(InputValidator.validateId(42)).toBe(42);
      expect(InputValidator.validateId(0)).toBe(0);
    });

    it('should throw RAGError for non-number input', () => {
      expect(() => InputValidator.validateId('123' as any))
        .toThrow(new RAGError('ID must be a number', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for non-integer input', () => {
      expect(() => InputValidator.validateId(3.14))
        .toThrow(new RAGError('ID must be an integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for negative ID', () => {
      expect(() => InputValidator.validateId(-1))
        .toThrow(new RAGError('ID must be non-negative', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for ID exceeding maximum safe integer', () => {
      expect(() => InputValidator.validateId(Number.MAX_SAFE_INTEGER + 1))
        .toThrow(new RAGError('ID exceeds maximum safe integer value', ErrorCodes.INVALID_INPUT));
    });

    it('should handle edge case of maximum safe integer', () => {
      expect(InputValidator.validateId(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('validateSearchQuantity', () => {
    it('should validate and return valid quantity', () => {
      expect(InputValidator.validateSearchQuantity(5)).toBe(5);
      expect(InputValidator.validateSearchQuantity(1)).toBe(1);
      expect(InputValidator.validateSearchQuantity(1000)).toBe(1000);
    });

    it('should throw RAGError for non-number input', () => {
      expect(() => InputValidator.validateSearchQuantity('5' as any))
        .toThrow(new RAGError('Quantity must be a number', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for non-integer input', () => {
      expect(() => InputValidator.validateSearchQuantity(5.5))
        .toThrow(new RAGError('Quantity must be an integer', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for quantity less than minimum', () => {
      expect(() => InputValidator.validateSearchQuantity(0))
        .toThrow(new RAGError('Quantity must be at least 1', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for quantity exceeding maximum', () => {
      expect(() => InputValidator.validateSearchQuantity(1001))
        .toThrow(new RAGError('Quantity cannot exceed 1000', ErrorCodes.INVALID_INPUT));
    });
  });

  describe('validateVector', () => {
    it('should validate and return valid vector', () => {
      const vector = [0.1, 0.2, 0.3];
      expect(InputValidator.validateVector(vector)).toEqual(vector);
    });

    it('should throw RAGError for non-array input', () => {
      expect(() => InputValidator.validateVector('not-array' as any))
        .toThrow(new RAGError('Vector must be an array', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty array', () => {
      expect(() => InputValidator.validateVector([]))
        .toThrow(new RAGError('Vector cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for vector exceeding dimension limit', () => {
      const largeVector = new Array(10001).fill(0.1);
      expect(() => InputValidator.validateVector(largeVector))
        .toThrow(new RAGError('Vector dimensions exceed reasonable limit', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for non-number elements', () => {
      expect(() => InputValidator.validateVector([0.1, 'string' as any, 0.3]))
        .toThrow(new RAGError('Vector element at index 1 must be a number', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for infinite values', () => {
      expect(() => InputValidator.validateVector([0.1, Infinity, 0.3]))
        .toThrow(new RAGError('Vector element at index 1 must be a finite number', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for NaN values', () => {
      expect(() => InputValidator.validateVector([0.1, NaN, 0.3]))
        .toThrow(new RAGError('Vector element at index 1 must be a finite number', ErrorCodes.INVALID_INPUT));
    });

    it('should handle negative numbers correctly', () => {
      const vector = [-0.1, 0.2, -0.3];
      expect(InputValidator.validateVector(vector)).toEqual(vector);
    });
  });

  describe('sanitizeText', () => {
    it('should remove null bytes and control characters', () => {
      const dirtyText = 'Hello\x00World\x01Test\x1F';
      const result = InputValidator.sanitizeText(dirtyText);
      expect(result).toBe('HelloWorldTest');
    });

    it('should preserve newlines and tabs', () => {
      const textWithWhitespace = 'Hello\nWorld\tTest';
      const result = InputValidator.sanitizeText(textWithWhitespace);
      expect(result).toBe('Hello\nWorld\tTest');
    });

    it('should handle empty string', () => {
      expect(InputValidator.sanitizeText('')).toBe('');
    });

    it('should handle normal text without changes', () => {
      const normalText = 'Hello World! This is normal text.';
      expect(InputValidator.sanitizeText(normalText)).toBe(normalText);
    });

    it('should handle unicode characters correctly', () => {
      const unicodeText = '你好世界 🌍 café';
      expect(InputValidator.sanitizeText(unicodeText)).toBe(unicodeText);
    });
  });

  describe('validateConfig', () => {
    it('should return empty object for null or undefined config', () => {
      expect(InputValidator.validateConfig(null)).toEqual({});
      expect(InputValidator.validateConfig(undefined)).toEqual({});
    });

    it('should throw RAGError for non-object config', () => {
      expect(() => InputValidator.validateConfig('string'))
        .toThrow(new RAGError('Configuration must be an object', ErrorCodes.INVALID_INPUT));
    });

    it('should validate and return valid configuration', () => {
      const config = {
        modelPath: './model.gguf',
        databasePath: './db.sqlite',
        logLevel: 'debug'
      };
      
      const result = InputValidator.validateConfig(config);
      expect(result).toEqual(config);
    });

    it('should trim string values', () => {
      const config = {
        modelPath: '  ./model.gguf  ',
        databasePath: '  ./db.sqlite  '
      };
      
      const result = InputValidator.validateConfig(config);
      expect(result).toEqual({
        modelPath: './model.gguf',
        databasePath: './db.sqlite'
      });
    });

    it('should throw RAGError for invalid modelPath type', () => {
      expect(() => InputValidator.validateConfig({ modelPath: 123 }))
        .toThrow(new RAGError('Model path must be a string', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty modelPath', () => {
      expect(() => InputValidator.validateConfig({ modelPath: '   ' }))
        .toThrow(new RAGError('Model path cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for invalid databasePath type', () => {
      expect(() => InputValidator.validateConfig({ databasePath: 123 }))
        .toThrow(new RAGError('Database path must be a string', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for empty databasePath', () => {
      expect(() => InputValidator.validateConfig({ databasePath: '' }))
        .toThrow(new RAGError('Database path cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError for invalid logLevel', () => {
      expect(() => InputValidator.validateConfig({ logLevel: 'invalid' }))
        .toThrow(new RAGError('Log level must be one of: debug, info, warn, error', ErrorCodes.INVALID_INPUT));
    });

    it('should accept valid logLevels', () => {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      
      validLevels.forEach(level => {
        const result = InputValidator.validateConfig({ logLevel: level });
        expect(result.logLevel).toBe(level);
      });
    });

    it('should ignore unknown properties', () => {
      const config = {
        modelPath: './model.gguf',
        unknownProperty: 'should be ignored'
      };
      
      const result = InputValidator.validateConfig(config);
      expect(result).toEqual({ modelPath: './model.gguf' });
    });

    it('should handle partial configuration', () => {
      const config = { modelPath: './model.gguf' };
      const result = InputValidator.validateConfig(config);
      expect(result).toEqual({ modelPath: './model.gguf' });
    });
  });
});
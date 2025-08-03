import { RAGModuleConfig, EmbedRequest, SaveRequest, SearchRequest } from './types/index.js';
import { RAGError, ErrorCodes } from './errors/index.js';
import { NoMicEmbeddingService } from './services/embedding.js';
import { SQLiteVectorDatabase } from './services/database.js';
import { SQLiteVectorSearchService } from './services/vectorSearch.js';
import { Logger } from './utils/logger.js';
import { InputValidator } from './utils/validation.js';

/**
 * Main RAG (Retrieval-Augmented Generation) module that provides text embedding,
 * vector storage, and similarity search functionality using nomic-embed-text-v1.5
 * and sqlite-vec.
 * 
 * @example
 * ```typescript
 * const rag = new RAGModule({
 *   modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
 *   databasePath: './vectors.db',
 *   logLevel: 'info'
 * });
 * 
 * await rag.initialize();
 * 
 * // Generate embedding
 * const vector = await rag.embed({ text: 'Hello world' });
 * 
 * // Save text with embedding
 * await rag.save({ id: 1, text: 'Hello world', tablename: 'documents' });
 * 
 * // Search for similar texts
 * const results = await rag.search({ 
 *   text: 'Hello', 
 *   tablename: 'documents', 
 *   qty: 5 
 * });
 * 
 * await rag.close();
 * ```
 */
export class RAGModule {
  private config: RAGModuleConfig;
  private initialized: boolean = false;
  private embeddingService: NoMicEmbeddingService;
  private databaseService: SQLiteVectorDatabase;
  private vectorSearchService: SQLiteVectorSearchService;
  private logger: Logger;

  /**
   * Creates a new RAGModule instance with the specified configuration.
   * 
   * @param config - Configuration options for the RAG module
   * @param config.modelPath - Path to the nomic-embed-text-v1.5 model file (default: './nomic-embed-text-v1.5.Q5_K_M.gguf')
   * @param config.databasePath - Path to the SQLite database file (default: './rag.db')
   * @param config.logLevel - Logging level for debug output (default: 'info')
   */
  constructor(config: RAGModuleConfig = {}) {
    // Validate and sanitize configuration
    const validatedConfig = InputValidator.validateConfig(config);
    
    this.config = {
      modelPath: validatedConfig.modelPath || './nomic-embed-text-v1.5.Q5_K_M.gguf',
      databasePath: validatedConfig.databasePath || './rag.db',
      logLevel: validatedConfig.logLevel || 'info'
    };
    
    this.logger = new Logger(this.config.logLevel);
    this.embeddingService = NoMicEmbeddingService.getInstance();
    this.databaseService = new SQLiteVectorDatabase();
    this.vectorSearchService = new SQLiteVectorSearchService();
  }

  /**
   * Generates a vector embedding for the given text using the nomic-embed-text-v1.5 model.
   * This method does not interact with the database and only performs text-to-vector conversion.
   * 
   * @param request - The embedding request containing the text to embed
   * @param request.text - The text string to generate an embedding for
   * @returns A Promise that resolves to a number array representing the vector embedding
   * @throws {RAGError} When the module is not initialized, text is empty, or embedding generation fails
   * 
   * @example
   * ```typescript
   * const vector = await rag.embed({ text: 'Hello world' });
   * console.log(vector); // [0.1, 0.2, 0.3, ...]
   * ```
   */
  async embed(request: EmbedRequest): Promise<number[]> {
    if (!this.initialized) {
      this.logger.error('Embed operation failed: RAG module not initialized');
      throw new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting embed operation', { textLength: request.text.length });

    try {
      // Validate input
      this.validateEmbedRequest(request);
      this.logger.debug('Embed request validation passed');

      // Generate embedding using the embedding service
      const vector = await this.embeddingService.embed(request.text);
      this.logger.debug('Embedding generated successfully', { vectorDimensions: vector.length });

      return vector;
    } catch (error) {
      this.logger.error('Embed operation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.EMBEDDING_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Embeds the given text and saves it with its vector representation to the specified table.
   * Creates the table if it doesn't exist and handles vector storage using sqlite-vec.
   * 
   * @param request - The save request containing the data to store
   * @param request.id - Unique identifier for the text (must be non-negative integer)
   * @param request.text - The text content to embed and save
   * @param request.tablename - Name of the table to store the vector (alphanumeric, underscore, hyphen allowed)
   * @returns A Promise that resolves to true if save was successful, false otherwise
   * @throws {RAGError} When the module is not initialized, input validation fails, or save operation fails
   * 
   * @example
   * ```typescript
   * const success = await rag.save({
   *   id: 1,
   *   text: 'This is a document to save',
   *   tablename: 'documents'
   * });
   * console.log(success); // true
   * ```
   */
  async save(request: SaveRequest): Promise<boolean> {
    if (!this.initialized) {
      this.logger.error('Save operation failed: RAG module not initialized');
      throw new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting save operation', { 
      id: request.id, 
      tablename: request.tablename, 
      textLength: request.text.length 
    });

    try {
      // Validate input
      this.validateSaveRequest(request);
      this.logger.debug('Save request validation passed');

      // Generate embedding for the text
      const vector = await this.embeddingService.embed(request.text);
      this.logger.debug('Embedding generated for save operation', { vectorDimensions: vector.length });

      // Ensure table exists
      await this.databaseService.createTableIfNotExists(request.tablename);
      this.logger.debug('Table ensured to exist', { tablename: request.tablename });

      // Insert vector into database
      const success = await this.databaseService.insertVector(
        request.tablename,
        request.id,
        vector
      );

      if (success) {
        this.logger.info('Vector saved successfully', { id: request.id, tablename: request.tablename });
      } else {
        this.logger.warn('Vector save operation returned false', { id: request.id, tablename: request.tablename });
      }

      return success;
    } catch (error) {
      this.logger.error('Save operation failed', { 
        id: request.id, 
        tablename: request.tablename,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to save vector: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.VECTOR_SAVE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Embeds the query text and searches for the most semantically similar texts in the specified table.
   * Returns the IDs of the closest matches ordered from most to least similar.
   * 
   * @param request - The search request containing the query parameters
   * @param request.text - The query text to search for similar content
   * @param request.tablename - Name of the table to search in (must exist and contain vectors)
   * @param request.qty - Number of closest matches to return (1-1000)
   * @returns A Promise that resolves to an array of IDs representing the closest matches
   * @throws {RAGError} When the module is not initialized, input validation fails, or search operation fails
   * 
   * @example
   * ```typescript
   * const results = await rag.search({
   *   text: 'machine learning algorithms',
   *   tablename: 'documents',
   *   qty: 5
   * });
   * console.log(results); // [3, 7, 1, 12, 5] - IDs ordered by similarity
   * ```
   */
  async search(request: SearchRequest): Promise<number[]> {
    if (!this.initialized) {
      this.logger.error('Search operation failed: RAG module not initialized');
      throw new RAGError('RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting search operation', { 
      tablename: request.tablename, 
      qty: request.qty, 
      textLength: request.text.length 
    });

    try {
      // Validate input
      this.validateSearchRequest(request);
      this.logger.debug('Search request validation passed');

      // Generate embedding for the query text
      const queryVector = await this.embeddingService.embed(request.text);
      this.logger.debug('Query embedding generated for search', { vectorDimensions: queryVector.length });

      // Perform vector similarity search
      const results = await this.vectorSearchService.search(
        request.tablename,
        queryVector,
        request.qty,
        this.databaseService
      );

      this.logger.info('Search operation completed successfully', { 
        tablename: request.tablename, 
        resultsCount: results.length,
        requestedQty: request.qty
      });

      return results;
    } catch (error) {
      this.logger.error('Search operation failed', { 
        tablename: request.tablename,
        qty: request.qty,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to search vectors: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.SEARCH_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Initializes the RAG module by loading the embedding model and connecting to the database.
   * Must be called before using any other methods (embed, save, search).
   * 
   * @returns A Promise that resolves when initialization is complete
   * @throws {RAGError} When model loading or database connection fails
   * 
   * @example
   * ```typescript
   * const rag = new RAGModule();
   * await rag.initialize(); // Required before using other methods
   * ```
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('RAG module already initialized, skipping initialization');
      return; // Already initialized
    }

    this.logger.info('Initializing RAG module', { 
      modelPath: this.config.modelPath, 
      databasePath: this.config.databasePath 
    });

    try {
      // Initialize embedding service with model path
      this.logger.debug('Initializing embedding service');
      await this.embeddingService.initialize(this.config.modelPath!);
      this.logger.debug('Embedding service initialized successfully');

      // Initialize database service with database path
      this.logger.debug('Initializing database service');
      await this.databaseService.initialize(this.config.databasePath!);
      this.logger.debug('Database service initialized successfully');

      this.initialized = true;
      this.logger.info('RAG module initialization completed successfully');
    } catch (error) {
      this.logger.error('RAG module initialization failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to initialize RAG module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Closes the RAG module by disposing of the embedding model and closing database connections.
   * Should be called when the module is no longer needed to free up resources.
   * 
   * @returns A Promise that resolves when cleanup is complete
   * @throws {RAGError} When resource cleanup fails
   * 
   * @example
   * ```typescript
   * await rag.close(); // Clean up resources when done
   * ```
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      this.logger.debug('RAG module already closed, skipping close operation');
      return; // Already closed
    }

    this.logger.info('Closing RAG module');

    try {
      // Close embedding service
      this.logger.debug('Closing embedding service');
      await this.embeddingService.close();
      this.logger.debug('Embedding service closed successfully');

      // Close database service
      this.logger.debug('Closing database service');
      await this.databaseService.close();
      this.logger.debug('Database service closed successfully');

      this.initialized = false;
      this.logger.info('RAG module closed successfully');
    } catch (error) {
      this.logger.error('RAG module close failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to close RAG module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  private validateSaveRequest(request: SaveRequest): void {
    // Validate and sanitize text
    request.text = InputValidator.validateText(request.text);
    request.text = InputValidator.sanitizeText(request.text);
    
    // Validate ID
    request.id = InputValidator.validateId(request.id);
    
    // Validate and sanitize table name
    request.tablename = InputValidator.validateTableName(request.tablename);
  }

  private validateSearchRequest(request: SearchRequest): void {
    // Validate and sanitize text
    request.text = InputValidator.validateText(request.text, 'Search text');
    request.text = InputValidator.sanitizeText(request.text);
    
    // Validate and sanitize table name
    request.tablename = InputValidator.validateTableName(request.tablename);
    
    // Validate search quantity
    request.qty = InputValidator.validateSearchQuantity(request.qty);
  }

  private validateEmbedRequest(request: EmbedRequest): void {
    // Validate and sanitize text
    request.text = InputValidator.validateText(request.text);
    request.text = InputValidator.sanitizeText(request.text);
  }
}

// Export types and errors for external use
export * from './types/index.js';
export * from './errors/index.js';
export { Logger } from './utils/logger.js';
export { InputValidator } from './utils/validation.js';
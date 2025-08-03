import { RAGModuleConfig, EmbedRequest, SearchRequest } from '../types/index.js';
import { RAGError, ErrorCodes } from '../errors/index.js';
import { NoMicEmbeddingService } from './embedding.js';
import { SQLiteVectorDatabase } from './database.js';
import { SQLiteVectorSearchService } from './vectorSearch.js';
import { MySQLDatabase, MySQLConfig, DocumentRecord } from './mysqlDatabase.js';
import { Logger } from '../utils/logger.js';
import { InputValidator } from '../utils/validation.js';

export interface HybridRAGConfig extends RAGModuleConfig {
  mysql: MySQLConfig;
}

export interface SaveDocumentRequest {
  title?: string;
  content: string;
  metadata?: any;
  tablename: string;
}

export interface SearchResult {
  id: number;
  title?: string;
  content: string;
  metadata?: any;
  similarity_score?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface HybridSearchRequest extends SearchRequest {
  includeContent?: boolean;
  includeMetadata?: boolean;
}

/**
 * Hybrid RAG system that combines MySQL for document storage with vector search capabilities.
 * Documents are stored in MySQL while their embeddings are stored in SQLite with sqlite-vec.
 * This allows for both semantic search and traditional database operations.
 */
export class HybridRAGModule {
  private config: HybridRAGConfig;
  private initialized: boolean = false;
  private embeddingService: NoMicEmbeddingService;
  private vectorDatabase: SQLiteVectorDatabase;
  private vectorSearchService: SQLiteVectorSearchService;
  private mysqlDatabase: MySQLDatabase;
  private logger: Logger;

  constructor(config: HybridRAGConfig) {
    this.config = {
      modelPath: config.modelPath || './nomic-embed-text-v1.5.Q5_K_M.gguf',
      databasePath: config.databasePath || './vectors.db',
      logLevel: config.logLevel || 'info',
      mysql: config.mysql
    };
    
    this.logger = new Logger(this.config.logLevel);
    this.embeddingService = NoMicEmbeddingService.getInstance();
    this.vectorDatabase = new SQLiteVectorDatabase();
    this.vectorSearchService = new SQLiteVectorSearchService();
    this.mysqlDatabase = new MySQLDatabase(this.config.mysql);
  }

  /**
   * Initialize both MySQL and vector databases
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing Hybrid RAG module');

    try {
      // Initialize embedding service
      await this.embeddingService.initialize(this.config.modelPath!);
      
      // Initialize vector database
      await this.vectorDatabase.initialize(this.config.databasePath!);
      
      // Initialize MySQL database
      await this.mysqlDatabase.initialize();

      this.initialized = true;
      this.logger.info('Hybrid RAG module initialized successfully');
    } catch (error) {
      throw new RAGError(
        `Failed to initialize Hybrid RAG module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Save a document to MySQL and its embedding to the vector database
   */
  async saveDocument(request: SaveDocumentRequest): Promise<number> {
    if (!this.initialized) {
      throw new RAGError('Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting save document operation', { 
      tablename: request.tablename,
      contentLength: request.content.length 
    });

    try {
      // Validate input
      this.validateSaveDocumentRequest(request);

      // Create MySQL table if it doesn't exist
      await this.mysqlDatabase.createDocumentsTable(request.tablename);

      // Save document to MySQL
      const documentId = await this.mysqlDatabase.insertDocument(request.tablename, {
        title: request.title,
        content: request.content,
        metadata: request.metadata
      });

      // Generate embedding for the content
      const vector = await this.embeddingService.embed(request.content);

      // Create vector table if it doesn't exist
      await this.vectorDatabase.createTableIfNotExists(request.tablename);

      // Save embedding to vector database with the same ID
      await this.vectorDatabase.insertVector(request.tablename, documentId, vector);

      this.logger.info('Document saved successfully', { 
        id: documentId, 
        tablename: request.tablename 
      });

      return documentId;
    } catch (error) {
      this.logger.error('Save document operation failed', { 
        tablename: request.tablename,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.VECTOR_SAVE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for similar documents using vector similarity and return full document data from MySQL
   */
  async searchDocuments(request: HybridSearchRequest): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new RAGError('Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting hybrid search operation', { 
      tablename: request.tablename, 
      qty: request.qty,
      textLength: request.text.length 
    });

    try {
      // Validate input
      this.validateSearchRequest(request);

      // Generate embedding for the query
      const queryVector = await this.embeddingService.embed(request.text);

      // Perform vector similarity search to get document IDs
      const similarIds = await this.vectorSearchService.search(
        request.tablename,
        queryVector,
        request.qty,
        this.vectorDatabase
      );

      if (similarIds.length === 0) {
        return [];
      }

      // Fetch full document data from MySQL
      const documents = await this.mysqlDatabase.getDocumentsByIds(
        request.tablename, 
        similarIds
      );

      // Transform to search results
      const results: SearchResult[] = documents.map((doc, index) => ({
        id: doc.id,
        title: doc.title,
        content: request.includeContent !== false ? doc.content : '',
        metadata: request.includeMetadata !== false ? doc.metadata : undefined,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        similarity_score: index // Lower index = higher similarity
      }));

      this.logger.info('Hybrid search completed successfully', { 
        tablename: request.tablename, 
        resultsCount: results.length 
      });

      return results;
    } catch (error) {
      this.logger.error('Hybrid search operation failed', { 
        tablename: request.tablename,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.SEARCH_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update a document in MySQL and regenerate its embedding
   */
  async updateDocument(
    tablename: string, 
    id: number, 
    updates: Partial<Omit<DocumentRecord, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new RAGError('Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      // Update document in MySQL
      const updated = await this.mysqlDatabase.updateDocument(tablename, id, updates);

      // If content was updated, regenerate embedding
      if (updated && updates.content) {
        const vector = await this.embeddingService.embed(updates.content);
        await this.vectorDatabase.insertVector(tablename, id, vector);
      }

      return updated;
    } catch (error) {
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.VECTOR_SAVE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a document from both MySQL and vector database
   */
  async deleteDocument(tablename: string, id: number): Promise<boolean> {
    if (!this.initialized) {
      throw new RAGError('Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      // Delete from MySQL
      const mysqlDeleted = await this.mysqlDatabase.deleteDocument(tablename, id);
      
      // Note: sqlite-vec doesn't have a direct delete method for individual vectors
      // You might need to recreate the table or use a different approach
      // For now, we'll just delete from MySQL
      
      return mysqlDeleted;
    } catch (error) {
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.VECTOR_SAVE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a document by ID from MySQL
   */
  async getDocument(tablename: string, id: number): Promise<DocumentRecord | null> {
    if (!this.initialized) {
      throw new RAGError('Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      const documents = await this.mysqlDatabase.getDocumentsByIds(tablename, [id]);
      return documents.length > 0 ? documents[0] : null;
    } catch (error) {
      if (error instanceof RAGError) {
        throw error;
      }
      throw new RAGError(
        `Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.SEARCH_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate embedding for text (utility method)
   */
  async embed(request: EmbedRequest): Promise<number[]> {
    if (!this.initialized) {
      throw new RAGError('Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      this.validateEmbedRequest(request);
      return await this.embeddingService.embed(request.text);
    } catch (error) {
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
   * Close all database connections
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.embeddingService.close();
      await this.vectorDatabase.close();
      await this.mysqlDatabase.close();
      
      this.initialized = false;
      this.logger.info('Hybrid RAG module closed successfully');
    } catch (error) {
      throw new RAGError(
        `Failed to close Hybrid RAG module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  private validateSaveDocumentRequest(request: SaveDocumentRequest): void {
    request.content = InputValidator.validateText(request.content, 'document content');
    request.content = InputValidator.sanitizeText(request.content);
    request.tablename = InputValidator.validateTableName(request.tablename);
    
    if (request.title) {
      request.title = InputValidator.sanitizeText(request.title);
    }
  }

  private validateSearchRequest(request: HybridSearchRequest): void {
    request.text = InputValidator.validateText(request.text, 'search text');
    request.text = InputValidator.sanitizeText(request.text);
    request.tablename = InputValidator.validateTableName(request.tablename);
    request.qty = InputValidator.validateSearchQuantity(request.qty);
  }

  private validateEmbedRequest(request: EmbedRequest): void {
    request.text = InputValidator.validateText(request.text);
    request.text = InputValidator.sanitizeText(request.text);
  }
}
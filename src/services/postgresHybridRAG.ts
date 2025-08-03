import { RAGModuleConfig, EmbedRequest, SearchRequest } from '../types/index.js';
import { RAGError, ErrorCodes } from '../errors/index.js';
import { NoMicEmbeddingService } from './embedding.js';
import { SQLiteVectorDatabase } from './database.js';
import { SQLiteVectorSearchService } from './vectorSearch.js';
import { PostgreSQLDatabase, PostgreSQLConfig, DocumentRecord } from './postgresDatabase.js';
import { Logger } from '../utils/logger.js';
import { InputValidator } from '../utils/validation.js';

export interface PostgresHybridRAGConfig extends RAGModuleConfig {
  postgres: PostgreSQLConfig;
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

export class PostgresHybridRAGModule {
  private config: PostgresHybridRAGConfig;
  private initialized: boolean = false;
  private embeddingService: NoMicEmbeddingService;
  private vectorDatabase: SQLiteVectorDatabase;
  private vectorSearchService: SQLiteVectorSearchService;
  private postgresDatabase: PostgreSQLDatabase;
  private logger: Logger;

  constructor(config: PostgresHybridRAGConfig) {
    this.config = {
      modelPath: config.modelPath || './nomic-embed-text-v1.5.Q5_K_M.gguf',
      databasePath: config.databasePath || './vectors.db',
      logLevel: config.logLevel || 'info',
      postgres: config.postgres
    };
    
    this.logger = new Logger(this.config.logLevel);
    this.embeddingService = NoMicEmbeddingService.getInstance();
    this.vectorDatabase = new SQLiteVectorDatabase();
    this.vectorSearchService = new SQLiteVectorSearchService();
    this.postgresDatabase = new PostgreSQLDatabase(this.config.postgres);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing PostgreSQL Hybrid RAG module');

    try {
      await this.embeddingService.initialize(this.config.modelPath!);
      await this.vectorDatabase.initialize(this.config.databasePath!);
      await this.postgresDatabase.initialize();

      this.initialized = true;
      this.logger.info('PostgreSQL Hybrid RAG module initialized successfully');
    } catch (error) {
      throw new RAGError(
        `Failed to initialize PostgreSQL Hybrid RAG module: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async saveDocument(request: SaveDocumentRequest): Promise<number> {
    if (!this.initialized) {
      throw new RAGError('PostgreSQL Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting save document operation', { 
      tablename: request.tablename,
      contentLength: request.content.length 
    });

    try {
      this.validateSaveDocumentRequest(request);

      await this.postgresDatabase.createDocumentsTable(request.tablename);

      const documentId = await this.postgresDatabase.insertDocument(request.tablename, {
        title: request.title,
        content: request.content,
        metadata: request.metadata
      });

      const vector = await this.embeddingService.embed(request.content);
      await this.vectorDatabase.createTableIfNotExists(request.tablename);
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

  async searchDocuments(request: HybridSearchRequest): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new RAGError('PostgreSQL Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    this.logger.debug('Starting hybrid search operation', { 
      tablename: request.tablename, 
      qty: request.qty,
      textLength: request.text.length 
    });

    try {
      this.validateSearchRequest(request);

      const queryVector = await this.embeddingService.embed(request.text);

      const similarIds = await this.vectorSearchService.search(
        request.tablename,
        queryVector,
        request.qty,
        this.vectorDatabase
      );

      if (similarIds.length === 0) {
        return [];
      }

      const documents = await this.postgresDatabase.getDocumentsByIds(
        request.tablename, 
        similarIds
      );

      const results: SearchResult[] = documents.map((doc, index) => ({
        id: doc.id,
        title: doc.title,
        content: request.includeContent !== false ? doc.content : '',
        metadata: request.includeMetadata !== false ? doc.metadata : undefined,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        similarity_score: index
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

  async updateDocument(
    tablename: string, 
    id: number, 
    updates: Partial<Omit<DocumentRecord, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    if (!this.initialized) {
      throw new RAGError('PostgreSQL Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      const updated = await this.postgresDatabase.updateDocument(tablename, id, updates);

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

  async deleteDocument(tablename: string, id: number): Promise<boolean> {
    if (!this.initialized) {
      throw new RAGError('PostgreSQL Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      const postgresDeleted = await this.postgresDatabase.deleteDocument(tablename, id);
      return postgresDeleted;
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

  async getDocument(tablename: string, id: number): Promise<DocumentRecord | null> {
    if (!this.initialized) {
      throw new RAGError('PostgreSQL Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
    }

    try {
      const documents = await this.postgresDatabase.getDocumentsByIds(tablename, [id]);
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

  async embed(request: EmbedRequest): Promise<number[]> {
    if (!this.initialized) {
      throw new RAGError('PostgreSQL Hybrid RAG module not initialized', ErrorCodes.INVALID_INPUT);
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

  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.embeddingService.close();
      await this.vectorDatabase.close();
      await this.postgresDatabase.close();
      
      this.initialized = false;
      this.logger.info('PostgreSQL Hybrid RAG module closed successfully');
    } catch (error) {
      throw new RAGError(
        `Failed to close PostgreSQL Hybrid RAG module: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
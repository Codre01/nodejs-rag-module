import { getLlama, LlamaModel, LlamaEmbeddingContext } from 'node-llama-cpp';
import { EmbeddingService } from '../types/index.js';
import { RAGError, ErrorCodes } from '../errors/index.js';

export class NoMicEmbeddingService implements EmbeddingService {
  private static instance: NoMicEmbeddingService;
  private model: LlamaModel | null = null;
  private embeddingContext: LlamaEmbeddingContext | null = null;
  private modelPath: string = '';
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): NoMicEmbeddingService {
    if (!NoMicEmbeddingService.instance) {
      NoMicEmbeddingService.instance = new NoMicEmbeddingService();
    }
    return NoMicEmbeddingService.instance;
  }

  async initialize(modelPath: string): Promise<void> {
    if (this.initialized && this.modelPath === modelPath) {
      return; // Already initialized with the same model
    }

    try {
      this.modelPath = modelPath;
      
      // Get llama instance
      const llama = await getLlama();
      
      // Load the model
      this.model = await llama.loadModel({
        modelPath: modelPath,
      });

      // Create embedding context
      this.embeddingContext = await this.model.createEmbeddingContext();

      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      this.model = null;
      this.embeddingContext = null;
      throw new RAGError(
        `Failed to initialize embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.initialized || !this.embeddingContext) {
      throw new RAGError('Embedding service not initialized', ErrorCodes.MODEL_LOAD_FAILED);
    }

    if (!text || text.trim().length === 0) {
      throw new RAGError('Text input cannot be empty', ErrorCodes.INVALID_INPUT);
    }

    try {
      // Use the embedding context to generate embeddings
      const result = await this.generateEmbedding(text);
      return Array.from(result);
    } catch (error) {
      throw new RAGError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.EMBEDDING_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.embeddingContext) {
      throw new Error('Embedding context not initialized');
    }
    
    // Use the actual node-llama-cpp API to generate embeddings
    const embedding = await this.embeddingContext.getEmbeddingFor(text);
    
    // Extract the vector from the LlamaEmbedding object and convert to Float32Array
    return new Float32Array(embedding.vector);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    try {
      if (this.embeddingContext) {
        await this.embeddingContext.dispose();
        this.embeddingContext = null;
      }
      if (this.model) {
        await this.model.dispose();
        this.model = null;
      }
      this.initialized = false;
    } catch (error) {
      throw new RAGError(
        `Failed to close embedding service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.MODEL_LOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }
}
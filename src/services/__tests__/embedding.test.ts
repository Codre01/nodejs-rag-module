import { NoMicEmbeddingService } from '../embedding';
import { RAGError, ErrorCodes } from '../../errors';

// Mock node-llama-cpp
jest.mock('node-llama-cpp', () => ({
  getLlama: jest.fn(),
}));

describe('NoMicEmbeddingService', () => {
  let embeddingService: NoMicEmbeddingService;
  let mockLlama: any;
  let mockModel: any;
  let mockEmbeddingContext: any;

  beforeEach(() => {
    embeddingService = NoMicEmbeddingService.getInstance();
    
    mockEmbeddingContext = {
      dispose: jest.fn(),
      getEmbeddingFor: jest.fn().mockResolvedValue({
        vector: new Array(768).fill(0).map(() => Math.random() * 2 - 1)
      }),
    };

    mockModel = {
      createEmbeddingContext: jest.fn().mockResolvedValue(mockEmbeddingContext),
      dispose: jest.fn(),
    };

    mockLlama = {
      loadModel: jest.fn().mockResolvedValue(mockModel),
    };

    const { getLlama } = require('node-llama-cpp');
    (getLlama as jest.Mock).mockResolvedValue(mockLlama);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Reset the singleton state
    try {
      await embeddingService.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('initialize', () => {
    it('should initialize successfully with valid model path', async () => {
      await embeddingService.initialize('./test-model.gguf');
      
      expect(embeddingService.isInitialized()).toBe(true);
      expect(mockLlama.loadModel).toHaveBeenCalledWith({
        modelPath: './test-model.gguf',
      });
      expect(mockModel.createEmbeddingContext).toHaveBeenCalled();
    });

    it('should throw RAGError when model loading fails', async () => {
      mockLlama.loadModel.mockRejectedValue(new Error('Model not found'));

      try {
        await embeddingService.initialize('./invalid-model.gguf');
      } catch (error) {
        expect(error).toBeInstanceOf(RAGError);
      }
      
      expect(embeddingService.isInitialized()).toBe(false);
    });

    it('should not reinitialize if already initialized with same model', async () => {
      await embeddingService.initialize('./test-model.gguf');
      mockLlama.loadModel.mockClear();
      
      await embeddingService.initialize('./test-model.gguf');
      
      expect(mockLlama.loadModel).not.toHaveBeenCalled();
    });
  });

  describe('embed', () => {
    beforeEach(async () => {
      await embeddingService.initialize('./test-model.gguf');
    });

    it('should generate embedding for valid text', async () => {
      const result = await embeddingService.embed('test text');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768); // Expected embedding size
      expect(result.every(val => typeof val === 'number')).toBe(true);
    });

    it('should throw RAGError when not initialized', async () => {
      const uninitializedService = new (NoMicEmbeddingService as any)();
      
      await expect(uninitializedService.embed('test text'))
        .rejects.toThrow(new RAGError('Embedding service not initialized', ErrorCodes.MODEL_LOAD_FAILED));
    });

    it('should throw RAGError for empty text', async () => {
      await expect(embeddingService.embed(''))
        .rejects.toThrow(new RAGError('Text input cannot be empty', ErrorCodes.INVALID_INPUT));
      
      await expect(embeddingService.embed('   '))
        .rejects.toThrow(new RAGError('Text input cannot be empty', ErrorCodes.INVALID_INPUT));
    });

    it('should throw RAGError when embedding generation fails', async () => {
      // Mock the private generateEmbedding method to throw an error
      const spy = jest.spyOn(embeddingService as any, 'generateEmbedding');
      spy.mockRejectedValue(new Error('Embedding failed'));

      await expect(embeddingService.embed('test text'))
        .rejects.toThrow(RAGError);
      
      spy.mockRestore();
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      await embeddingService.initialize('./test-model.gguf');
    });

    it('should close successfully and dispose resources', async () => {
      await embeddingService.close();

      expect(mockEmbeddingContext.dispose).toHaveBeenCalled();
      expect(mockModel.dispose).toHaveBeenCalled();
      expect(embeddingService.isInitialized()).toBe(false);
    });

    it('should handle disposal errors gracefully', async () => {
      mockEmbeddingContext.dispose.mockRejectedValue(new Error('Disposal failed'));

      await expect(embeddingService.close()).rejects.toThrow(RAGError);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NoMicEmbeddingService.getInstance();
      const instance2 = NoMicEmbeddingService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});
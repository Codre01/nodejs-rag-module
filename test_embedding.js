import { NoMicEmbeddingService } from './dist/services/embedding.js';

async function testEmbedding() {
  try {
    const embeddingService = NoMicEmbeddingService.getInstance();
    
    console.log('Initializing embedding service...');
    await embeddingService.initialize('./nomic-embed-text-v1.5.Q5_K_M.gguf');
    
    console.log('Generating embedding for test text...');
    const embedding = await embeddingService.embed('This is a test text for embedding generation.');
    
    console.log('Embedding generated successfully!');
    console.log('Embedding length:', embedding.length);
    console.log('First 10 values:', embedding.slice(0, 10));
    
    await embeddingService.close();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEmbedding();
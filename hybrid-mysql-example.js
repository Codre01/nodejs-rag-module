const { HybridRAGModule } = require('./dist/services/hybridRAG.js');

async function demonstrateHybridRAG() {
  // Initialize the hybrid RAG system
  const hybridRAG = new HybridRAGModule({
    // Vector database configuration
    modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: './hybrid-vectors.db',
    logLevel: 'info',
    
    // MySQL configuration
    mysql: {
      host: 'localhost',
      port: 3306,
      user: 'your_username',
      password: 'your_password',
      database: 'your_database',
      connectionLimit: 10
    }
  });

  try {
    console.log('🚀 Initializing Hybrid RAG system...');
    await hybridRAG.initialize();
    console.log('✅ Hybrid RAG system initialized successfully!');

    // Sample documents to save
    const documents = [
      {
        title: 'Machine Learning Basics',
        content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data without being explicitly programmed.',
        metadata: { category: 'AI', difficulty: 'beginner', tags: ['ML', 'AI', 'algorithms'] },
        tablename: 'knowledge_base'
      },
      {
        title: 'Deep Learning Networks',
        content: 'Deep learning uses neural networks with multiple layers to model and understand complex patterns in data, enabling breakthroughs in image recognition and natural language processing.',
        metadata: { category: 'AI', difficulty: 'advanced', tags: ['deep learning', 'neural networks', 'NLP'] },
        tablename: 'knowledge_base'
      },
      {
        title: 'Database Design Principles',
        content: 'Good database design involves normalization, proper indexing, and understanding relationships between entities to ensure data integrity and optimal performance.',
        metadata: { category: 'Database', difficulty: 'intermediate', tags: ['database', 'design', 'SQL'] },
        tablename: 'knowledge_base'
      },
      {
        title: 'RESTful API Development',
        content: 'REST APIs provide a standardized way for applications to communicate over HTTP, using standard methods like GET, POST, PUT, and DELETE to manipulate resources.',
        metadata: { category: 'Web Development', difficulty: 'intermediate', tags: ['API', 'REST', 'HTTP'] },
        tablename: 'knowledge_base'
      }
    ];

    console.log('\n📝 Saving documents to hybrid system...');
    const savedIds = [];
    
    for (const doc of documents) {
      const id = await hybridRAG.saveDocument(doc);
      savedIds.push(id);
      console.log(`✅ Saved "${doc.title}" with ID: ${id}`);
    }

    console.log('\n🔍 Performing semantic searches...');
    
    // Search for AI-related content
    console.log('\n--- Searching for "artificial intelligence algorithms" ---');
    const aiResults = await hybridRAG.searchDocuments({
      text: 'artificial intelligence algorithms',
      tablename: 'knowledge_base',
      qty: 3,
      includeContent: true,
      includeMetadata: true
    });

    aiResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (ID: ${result.id})`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
      console.log(`   Category: ${result.metadata?.category}`);
      console.log(`   Tags: ${result.metadata?.tags?.join(', ')}`);
      console.log('');
    });

    // Search for database-related content
    console.log('\n--- Searching for "database optimization performance" ---');
    const dbResults = await hybridRAG.searchDocuments({
      text: 'database optimization performance',
      tablename: 'knowledge_base',
      qty: 2,
      includeContent: true,
      includeMetadata: true
    });

    dbResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (ID: ${result.id})`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
      console.log(`   Category: ${result.metadata?.category}`);
      console.log('');
    });

    // Demonstrate document retrieval by ID
    console.log('\n📄 Retrieving specific document by ID...');
    const specificDoc = await hybridRAG.getDocument('knowledge_base', savedIds[0]);
    if (specificDoc) {
      console.log(`Retrieved: ${specificDoc.title}`);
      console.log(`Created: ${specificDoc.created_at}`);
      console.log(`Metadata: ${JSON.stringify(specificDoc.metadata, null, 2)}`);
    }

    // Demonstrate document update
    console.log('\n✏️  Updating a document...');
    const updateSuccess = await hybridRAG.updateDocument('knowledge_base', savedIds[0], {
      content: 'Machine learning is a powerful subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed for every task.',
      metadata: { 
        category: 'AI', 
        difficulty: 'beginner', 
        tags: ['ML', 'AI', 'algorithms', 'learning'],
        updated: true
      }
    });
    console.log(`Update successful: ${updateSuccess}`);

    // Search again to see if the updated content affects results
    console.log('\n🔍 Searching again after update...');
    const updatedResults = await hybridRAG.searchDocuments({
      text: 'computers learning from experience',
      tablename: 'knowledge_base',
      qty: 2,
      includeContent: true
    });

    updatedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (ID: ${result.id})`);
      console.log(`   Content: ${result.content.substring(0, 120)}...`);
      console.log('');
    });

    console.log('\n🎯 Hybrid RAG demonstration completed successfully!');
    console.log('\nKey Benefits:');
    console.log('• Documents stored in MySQL with full ACID compliance');
    console.log('• Fast semantic search using vector embeddings');
    console.log('• Rich metadata and relational capabilities');
    console.log('• Scalable architecture for production use');

  } catch (error) {
    console.error('❌ Error during demonstration:', error.message);
    if (error.cause) {
      console.error('Caused by:', error.cause.message);
    }
  } finally {
    // Clean up resources
    console.log('\n🧹 Cleaning up resources...');
    await hybridRAG.close();
    console.log('✅ Resources cleaned up successfully');
  }
}

// Additional utility functions for advanced use cases
async function demonstrateAdvancedFeatures() {
  const hybridRAG = new HybridRAGModule({
    modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: './hybrid-vectors.db',
    mysql: {
      host: 'localhost',
      user: 'your_username',
      password: 'your_password',
      database: 'your_database'
    }
  });

  await hybridRAG.initialize();

  try {
    // Example: Building a knowledge base with different document types
    const documentTypes = [
      {
        title: 'User Manual - Authentication',
        content: 'To authenticate users, implement OAuth 2.0 with JWT tokens. Store user sessions securely and implement proper logout mechanisms.',
        metadata: { type: 'manual', section: 'auth', version: '1.0' },
        tablename: 'documentation'
      },
      {
        title: 'FAQ - Password Reset',
        content: 'Users can reset their passwords by clicking the forgot password link and following the email instructions. The reset link expires after 24 hours.',
        metadata: { type: 'faq', category: 'account', priority: 'high' },
        tablename: 'support'
      },
      {
        title: 'API Reference - User Endpoints',
        content: 'GET /api/users/{id} retrieves user information. POST /api/users creates a new user. PUT /api/users/{id} updates user data.',
        metadata: { type: 'api', version: '2.1', endpoints: ['users'] },
        tablename: 'api_docs'
      }
    ];

    // Save documents to different tables
    for (const doc of documentTypes) {
      const id = await hybridRAG.saveDocument(doc);
      console.log(`Saved ${doc.metadata.type} document: ${doc.title} (ID: ${id})`);
    }

    // Cross-table search example
    console.log('\n🔍 Searching across different document types...');
    
    // Search in documentation table
    const authDocs = await hybridRAG.searchDocuments({
      text: 'user authentication security',
      tablename: 'documentation',
      qty: 5
    });
    
    // Search in support table
    const supportDocs = await hybridRAG.searchDocuments({
      text: 'user authentication security',
      tablename: 'support',
      qty: 5
    });

    console.log(`Found ${authDocs.length} documentation results`);
    console.log(`Found ${supportDocs.length} support results`);

  } finally {
    await hybridRAG.close();
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateHybridRAG()
    .then(() => {
      console.log('\n🎉 All demonstrations completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demonstration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  demonstrateHybridRAG,
  demonstrateAdvancedFeatures
};
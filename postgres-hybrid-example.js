import { PostgresHybridRAGModule } from './dist/services/postgresHybridRAG.js';

async function demonstratePostgresHybridRAG() {
  const postgresRAG = new PostgresHybridRAGModule({
    modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: './postgres-vectors.db',
    logLevel: 'info',
    
    postgres: {
      host: 'localhost',
      port: 5432,
      user: 'rag_user',
      password: 'your_password',
      database: 'rag_documents',
      max: 10,
      ssl: false
    }
  });

  try {
    console.log('🚀 Initializing PostgreSQL Hybrid RAG system...');
    await postgresRAG.initialize();
    console.log('✅ PostgreSQL Hybrid RAG system initialized successfully!');

    const documents = [
      {
        title: 'PostgreSQL Performance',
        content: 'PostgreSQL is a powerful, open source object-relational database system with advanced features for performance optimization and scalability.',
        metadata: { category: 'Database', difficulty: 'intermediate', tags: ['postgresql', 'performance', 'database'] },
        tablename: 'tech_articles'
      },
      {
        title: 'Vector Databases Explained',
        content: 'Vector databases are specialized databases designed to store and query high-dimensional vectors efficiently, enabling semantic search and AI applications.',
        metadata: { category: 'AI', difficulty: 'advanced', tags: ['vectors', 'AI', 'search'] },
        tablename: 'tech_articles'
      },
      {
        title: 'RAG Architecture Patterns',
        content: 'Retrieval-Augmented Generation combines the power of large language models with external knowledge bases to provide accurate and contextual responses.',
        metadata: { category: 'AI', difficulty: 'advanced', tags: ['RAG', 'LLM', 'architecture'] },
        tablename: 'tech_articles'
      }
    ];

    console.log('\n📝 Saving documents to PostgreSQL hybrid system...');
    const savedIds = [];
    
    for (const doc of documents) {
      const id = await postgresRAG.saveDocument(doc);
      savedIds.push(id);
      console.log(`✅ Saved "${doc.title}" with ID: ${id}`);
    }

    console.log('\n🔍 Performing semantic searches...');
    
    console.log('\n--- Searching for "database performance optimization" ---');
    const dbResults = await postgresRAG.searchDocuments({
      text: 'database performance optimization',
      tablename: 'tech_articles',
      qty: 3,
      includeContent: true,
      includeMetadata: true
    });

    dbResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (ID: ${result.id})`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
      console.log(`   Category: ${result.metadata?.category}`);
      console.log(`   Tags: ${result.metadata?.tags?.join(', ')}`);
      console.log('');
    });

    console.log('\n--- Searching for "AI vector search applications" ---');
    const aiResults = await postgresRAG.searchDocuments({
      text: 'AI vector search applications',
      tablename: 'tech_articles',
      qty: 2,
      includeContent: true,
      includeMetadata: true
    });

    aiResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (ID: ${result.id})`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
      console.log(`   Category: ${result.metadata?.category}`);
      console.log('');
    });

    console.log('\n📄 Retrieving specific document by ID...');
    const specificDoc = await postgresRAG.getDocument('tech_articles', savedIds[0]);
    if (specificDoc) {
      console.log(`Retrieved: ${specificDoc.title}`);
      console.log(`Created: ${specificDoc.created_at}`);
      console.log(`Metadata: ${JSON.stringify(specificDoc.metadata, null, 2)}`);
    }

    console.log('\n✏️  Updating a document...');
    const updateSuccess = await postgresRAG.updateDocument('tech_articles', savedIds[0], {
      content: 'PostgreSQL is an advanced, enterprise-class open source relational database that supports both SQL and JSON querying with exceptional performance and reliability.',
      metadata: { 
        category: 'Database', 
        difficulty: 'intermediate', 
        tags: ['postgresql', 'performance', 'database', 'enterprise'],
        updated: true
      }
    });
    console.log(`Update successful: ${updateSuccess}`);

    console.log('\n🔍 Searching again after update...');
    const updatedResults = await postgresRAG.searchDocuments({
      text: 'enterprise database reliability',
      tablename: 'tech_articles',
      qty: 2,
      includeContent: true
    });

    updatedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (ID: ${result.id})`);
      console.log(`   Content: ${result.content.substring(0, 120)}...`);
      console.log('');
    });

    console.log('\n🎯 PostgreSQL Hybrid RAG demonstration completed successfully!');
    console.log('\nKey Benefits:');
    console.log('• Documents stored in PostgreSQL with ACID compliance');
    console.log('• Advanced JSON/JSONB support for metadata');
    console.log('• Full-text search capabilities');
    console.log('• Fast semantic search using vector embeddings');
    console.log('• Enterprise-grade scalability and reliability');

  } catch (error) {
    console.error('❌ Error during demonstration:', error.message);
    if (error.cause) {
      console.error('Caused by:', error.cause.message);
    }
  } finally {
    console.log('\n🧹 Cleaning up resources...');
    await postgresRAG.close();
    console.log('✅ Resources cleaned up successfully');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demonstratePostgresHybridRAG()
    .then(() => {
      console.log('\n🎉 PostgreSQL demonstration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demonstration failed:', error);
      process.exit(1);
    });
}

export { demonstratePostgresHybridRAG };
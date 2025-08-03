import { RAGModule } from './dist/index.js';

async function main() {
    console.log('=== Comprehensive RAG Module Example ===\n');

    const rag = new RAGModule({
        modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
        databasePath: './comprehensive-example.db',
        logLevel: 'error'
    });

    try {
        console.log('1. Initializing RAG module...');
        await rag.initialize();
        console.log('✓ RAG module initialized successfully!\n');

        // Add multiple documents
        const documents = [
            { id: 1, text: 'Machine learning is a subset of artificial intelligence' },
            { id: 2, text: 'Deep learning uses neural networks with multiple layers' },
            { id: 3, text: 'Natural language processing helps computers understand human language' },
            { id: 4, text: 'Computer vision enables machines to interpret visual information' },
            { id: 5, text: 'Reinforcement learning trains agents through rewards and penalties' }
        ];

        console.log('2. Saving documents to database...');
        for (const doc of documents) {
            const success = await rag.save({
                id: doc.id,
                text: doc.text,
                tablename: 'ai_documents'
            });
            console.log(`   Document ${doc.id}: ${success ? '✓' : '✗'} - "${doc.text.substring(0, 50)}..."`);
        }
        console.log();

        // Test different search queries
        const searchQueries = [
            'artificial intelligence and machine learning',
            'neural networks and deep learning',
            'understanding human language',
            'visual recognition systems'
        ];

        console.log('3. Testing similarity search...');
        for (const query of searchQueries) {
            console.log(`\n   Query: "${query}"`);
            const results = await rag.search({
                text: query,
                tablename: 'ai_documents',
                qty: 3
            });

            console.log(`   Found ${results.length} similar documents:`);
            for (let i = 0; i < results.length; i++) {
                const docId = results[i];
                const doc = documents.find(d => d.id === docId);
                console.log(`     ${i + 1}. ID ${docId}: "${doc ? doc.text : 'Unknown document'}"`);
            }
        }

        console.log('\n4. Testing direct embedding generation...');
        const testText = 'This is a test for embedding generation';
        const embedding = await rag.embed({ text: testText });
        console.log(`   Generated ${embedding.length}-dimensional embedding for: "${testText}"`);
        console.log(`   First 5 dimensions: [${embedding.slice(0, 5).map(x => x.toFixed(4)).join(', ')}...]`);

        console.log('\n5. Closing RAG module...');
        await rag.close();
        console.log('✓ RAG module closed successfully!');

        console.log('\n=== Example completed successfully! ===');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
    }
}

main().catch(console.error);
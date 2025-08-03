# Embedding Vector Database (RAG Module)

A powerful Node.js TypeScript module for **Retrieval-Augmented Generation (RAG)** that provides text embedding, vector storage, and semantic search capabilities. Built with **nomic-embed-text-v1.5** model and **sqlite-vec** for efficient vector operations.

## 🚀 Features

- **Vector Database**: High-performance vector storage using SQLite with sqlite-vec extension
- **RAG Implementation**: Complete RAG pipeline with embedding, storage, and retrieval
- **Semantic Search**: Find semantically similar content using vector similarity
- **Multi-Database Support**: Compatible with SQLite, MySQL, and PostgreSQL
- **Local Processing**: Runs entirely on your computer without requiring GPU
- **Flexible Embedding Models**: Works with any embedding model of your choice
- **Production Ready**: Built with TypeScript, comprehensive error handling, and logging

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Database Support](#database-support)
- [Embedding Models](#embedding-models)
- [Real-World Applications](#real-world-applications)
- [Examples](#examples)
- [Performance](#performance)
- [Contributing](#contributing)

## 🛠 Installation

### Prerequisites

- **Node.js** >= 16.0.0
- **npm** or **yarn**
- **SQLite3** (automatically installed)

### Basic Installation

```bash
npm install nodejs-rag-module
```

### Development Installation

```bash
git clone <repository-url>
cd embedding-vec2-o
npm install
npm run build
```

### Required Dependencies

The module automatically installs these core dependencies:

```json
{
  "sqlite3": "^5.1.6",
  "sqlite-vec": "^0.1.7-alpha.2",
  "node-llama-cpp": "^3.10.0",
  "mysql2": "^3.14.2",
  "pg": "^8.11.3"
}
```

## ⚙️ Configuration

### Basic Configuration

```typescript
import { RAGModule } from 'nodejs-rag-module';

const rag = new RAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',  // Path to embedding model
  databasePath: './vectors.db',                        // SQLite database path
  logLevel: 'info'                                     // Logging level
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `modelPath` | string | `'./nomic-embed-text-v1.5.Q5_K_M.gguf'` | Path to the embedding model file |
| `databasePath` | string | `'./rag.db'` | Path to SQLite database file |
| `logLevel` | string | `'info'` | Logging level: 'debug', 'info', 'warn', 'error' |

### Hybrid RAG Configuration (MySQL)

```typescript
import { HybridRAGModule } from 'nodejs-rag-module/services/hybridRAG';

const hybridRAG = new HybridRAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
  databasePath: './vectors.db',
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'your_username',
    password: 'your_password',
    database: 'your_database',
    connectionLimit: 10
  }
});
```

### Hybrid RAG Configuration (PostgreSQL)

```typescript
import { PostgresHybridRAGModule } from 'nodejs-rag-module/services/postgresHybridRAG';

const postgresRAG = new PostgresHybridRAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
  databasePath: './vectors.db',
  postgres: {
    host: 'localhost',
    port: 5432,
    user: 'your_username',
    password: 'your_password',
    database: 'your_database',
    max: 10
  }
});
```

## 🚀 Quick Start

### 1. Initialize the Module

```typescript
import { RAGModule } from 'nodejs-rag-module';

const rag = new RAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
  databasePath: './my-vectors.db'
});

// Initialize (required before use)
await rag.initialize();
```

### 2. Save Documents

```typescript
// Save text with embeddings
await rag.save({
  id: 1,
  text: 'Machine learning is a subset of artificial intelligence',
  tablename: 'documents'
});

await rag.save({
  id: 2,
  text: 'Deep learning uses neural networks with multiple layers',
  tablename: 'documents'
});
```

### 3. Search for Similar Content

```typescript
// Find semantically similar documents
const results = await rag.search({
  text: 'artificial intelligence and neural networks',
  tablename: 'documents',
  qty: 5
});

console.log('Similar document IDs:', results); // [1, 2]
```

### 4. Generate Embeddings

```typescript
// Generate embedding vector for any text
const vector = await rag.embed({
  text: 'This is a sample text for embedding'
});

console.log('Vector dimensions:', vector.length); // 768
console.log('First 5 values:', vector.slice(0, 5));
```

### 5. Clean Up

```typescript
// Close connections and free resources
await rag.close();
```

## 📚 API Reference

### RAGModule Class

#### Constructor

```typescript
new RAGModule(config?: RAGModuleConfig)
```

#### Methods

##### `initialize(): Promise<void>`
Initializes the embedding model and database connection. **Must be called before using other methods.**

##### `embed(request: EmbedRequest): Promise<number[]>`
Generates vector embedding for text without storing it.

```typescript
const vector = await rag.embed({ text: 'Hello world' });
```

##### `save(request: SaveRequest): Promise<boolean>`
Embeds text and saves it with vector to database.

```typescript
const success = await rag.save({
  id: 1,
  text: 'Document content',
  tablename: 'my_documents'
});
```

##### `search(request: SearchRequest): Promise<number[]>`
Searches for semantically similar texts and returns matching IDs.

```typescript
const results = await rag.search({
  text: 'search query',
  tablename: 'my_documents',
  qty: 10
});
```

##### `close(): Promise<void>`
Closes all connections and frees resources.

### Type Definitions

```typescript
interface RAGModuleConfig {
  modelPath?: string;
  databasePath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

interface EmbedRequest {
  text: string;
}

interface SaveRequest {
  id: number;
  text: string;
  tablename: string;
}

interface SearchRequest {
  text: string;
  tablename: string;
  qty: number;
}
```

## 🗄️ Database Support

### Database Support Matrix

| Database | Vector Storage | Document Storage | Metadata | Full-text Search | Connection Pooling |
|----------|---------------|------------------|----------|------------------|--------------------|
| **SQLite** | ✅ sqlite-vec | ❌ | ❌ | ❌ | ❌ |
| **MySQL** | ❌ | ✅ | ✅ JSON | ❌ | ✅ |
| **PostgreSQL** | ❌ | ✅ | ✅ JSONB | ✅ Built-in | ✅ |

### SQLite (Primary)
- **Built-in support** with sqlite-vec extension
- **Local storage** with no external dependencies
- **High performance** vector operations
- **ACID compliance** for data integrity

```typescript
const rag = new RAGModule({
  databasePath: './my-vectors.db'
});
```

### MySQL Support
- **Production-ready** with connection pooling
- **Rich metadata** storage capabilities
- **Hybrid architecture** (vectors in SQLite, documents in MySQL)

```typescript
const hybridRAG = new HybridRAGModule({
  mysql: {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'my_database'
  }
});
```

### PostgreSQL Support
- **Enterprise-grade** with advanced JSON/JSONB support
- **Full-text search** capabilities built-in
- **Hybrid architecture** (vectors in SQLite, documents in PostgreSQL)
- **ACID compliance** with advanced transaction support

```typescript
const postgresRAG = new PostgresHybridRAGModule({
  postgres: {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'my_database'
  }
});
```

## 🤖 Embedding Models

### Default Model: nomic-embed-text-v1.5

The module uses **nomic-embed-text-v1.5** by default, which provides:
- **768-dimensional** vectors
- **High-quality** text embeddings
- **Efficient** quantized versions (Q4_K_M, Q5_K_M)
- **No GPU required** for inference

### Model Sources

#### 1. Hugging Face
```bash
# Download from Hugging Face
wget https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q5_K_M.gguf
```

#### 2. Direct Download
```bash
# Using curl
curl -L -o nomic-embed-text-v1.5.Q5_K_M.gguf \
  "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q5_K_M.gguf"
```

#### 3. Alternative Models
The module works with any GGUF-format embedding model:

```typescript
const rag = new RAGModule({
  modelPath: './your-custom-model.gguf'
});
```

### ⚠️ Important: Model Consistency

**The same embedding model used to embed text into the vector database MUST be used for searching.** Using different models will result in incompatible vector spaces and poor search results.

```typescript
// ✅ Correct: Same model for embedding and searching
const rag = new RAGModule({ modelPath: './model-v1.5.gguf' });
await rag.save({ id: 1, text: 'document', tablename: 'docs' });
const results = await rag.search({ text: 'query', tablename: 'docs', qty: 5 });

// ❌ Incorrect: Different models will not work properly
const rag1 = new RAGModule({ modelPath: './model-v1.5.gguf' });
const rag2 = new RAGModule({ modelPath: './different-model.gguf' });
await rag1.save({ id: 1, text: 'document', tablename: 'docs' });
await rag2.search({ text: 'query', tablename: 'docs', qty: 5 }); // Poor results!
```

## 🌍 Real-World Applications

### 1. Document Search Systems
Build intelligent document search for:
- **Knowledge bases** and wikis
- **Legal document** repositories
- **Technical documentation** search
- **Research paper** discovery

```typescript
// Index research papers
await rag.save({
  id: 1,
  text: 'Attention mechanisms in transformer architectures enable...',
  tablename: 'research_papers'
});

// Find related papers
const similar = await rag.search({
  text: 'transformer attention mechanisms',
  tablename: 'research_papers',
  qty: 10
});
```

### 2. Customer Support Systems
- **FAQ matching** for automated responses
- **Ticket routing** based on content similarity
- **Knowledge article** recommendations

### 3. Content Recommendation
- **Article recommendations** for blogs/news
- **Product suggestions** based on descriptions
- **Similar content** discovery

### 4. Code Search and Analysis
- **Code snippet** similarity search
- **API documentation** matching
- **Bug report** categorization

### 5. E-commerce Applications
- **Product search** by description
- **Similar product** recommendations
- **Review analysis** and categorization

## 📖 Examples

### Complete RAG Workflow

```typescript
import { RAGModule } from 'nodejs-rag-module';

async function ragWorkflow() {
  const rag = new RAGModule({
    modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: './knowledge-base.db',
    logLevel: 'info'
  });

  try {
    // Initialize
    await rag.initialize();

    // Add knowledge base articles
    const articles = [
      { id: 1, text: 'Machine learning algorithms learn patterns from data' },
      { id: 2, text: 'Neural networks are inspired by biological neurons' },
      { id: 3, text: 'Deep learning uses multiple layers for complex patterns' },
      { id: 4, text: 'Natural language processing helps computers understand text' }
    ];

    // Save all articles
    for (const article of articles) {
      await rag.save({
        id: article.id,
        text: article.text,
        tablename: 'knowledge_base'
      });
    }

    // Search for relevant articles
    const results = await rag.search({
      text: 'How do neural networks work?',
      tablename: 'knowledge_base',
      qty: 3
    });

    console.log('Most relevant articles:', results);
    
  } finally {
    await rag.close();
  }
}
```

### Hybrid MySQL Example

```typescript
import { HybridRAGModule } from 'nodejs-rag-module/services/hybridRAG';

async function hybridExample() {
  const hybridRAG = new HybridRAGModule({
    modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: './vectors.db',
    mysql: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'documents'
    }
  });

  await hybridRAG.initialize();

  // Save document with rich metadata
  const docId = await hybridRAG.saveDocument({
    title: 'AI Research Paper',
    content: 'Artificial intelligence research focuses on creating intelligent machines...',
    metadata: {
      author: 'Dr. Smith',
      category: 'AI',
      tags: ['machine learning', 'research'],
      published: '2024-01-15'
    },
    tablename: 'research_papers'
  });

  // Search with full document data
  const results = await hybridRAG.searchDocuments({
    text: 'artificial intelligence research',
    tablename: 'research_papers',
    qty: 5,
    includeContent: true,
    includeMetadata: true
  });

  console.log('Search results with metadata:', results);
  
  await hybridRAG.close();
}
```

### Batch Processing Example

```typescript
async function batchProcessing() {
  const rag = new RAGModule();
  await rag.initialize();

  // Process large dataset
  const documents = await loadLargeDataset(); // Your data loading function
  
  for (let i = 0; i < documents.length; i += 100) {
    const batch = documents.slice(i, i + 100);
    
    // Process in batches to manage memory
    for (const doc of batch) {
      await rag.save({
        id: doc.id,
        text: doc.content,
        tablename: 'large_dataset'
      });
    }
    
    console.log(`Processed ${i + batch.length} documents`);
  }

  await rag.close();
}
```

## ⚡ Performance

### System Requirements
- **CPU**: Any modern CPU (no GPU required)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: Varies by dataset size
- **Node.js**: Version 16+ for optimal performance

### Performance Characteristics
- **Embedding Speed**: ~100-500 texts/second (depends on text length)
- **Search Speed**: Sub-millisecond for datasets up to 100K vectors
- **Memory Usage**: ~2GB for model + dataset-dependent storage
- **Scalability**: Tested with millions of vectors

### Optimization Tips

1. **Batch Operations**: Process multiple documents together
2. **Connection Pooling**: Use hybrid mode for high-concurrency applications
3. **Index Management**: Let sqlite-vec handle indexing automatically
4. **Memory Management**: Close connections when not needed

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone <repository-url>
cd embedding-vec2-o
npm install
npm run build
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- database.test.ts
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🔗 Related Projects

- [nomic-embed-text](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5) - The embedding model
- [sqlite-vec](https://github.com/asg017/sqlite-vec) - Vector extension for SQLite
- [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) - Node.js bindings for llama.cpp

---

**Built with ❤️ for the AI community**
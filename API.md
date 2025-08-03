# API Reference

Complete API documentation for the Embedding Vector Database (RAG Module).

## Table of Contents

- [RAGModule](#ragmodule)
- [HybridRAGModule](#hybridragmodule)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Examples](#examples)

## RAGModule

The main class for basic RAG functionality with SQLite vector storage.

### Constructor

```typescript
new RAGModule(config?: RAGModuleConfig)
```

Creates a new RAGModule instance with optional configuration.

**Parameters:**
- `config` (optional): Configuration object for the RAG module

**Example:**
```typescript
const rag = new RAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
  databasePath: './vectors.db',
  logLevel: 'info'
});
```

### Methods

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initializes the embedding model and database connection. **Must be called before using other methods.**

**Returns:** Promise that resolves when initialization is complete

**Throws:** `RAGError` when model loading or database connection fails

**Example:**
```typescript
await rag.initialize();
```

#### embed()

```typescript
async embed(request: EmbedRequest): Promise<number[]>
```

Generates vector embedding for text without storing it in the database.

**Parameters:**
- `request.text` (string): The text to generate an embedding for

**Returns:** Promise that resolves to a number array representing the vector embedding

**Throws:** `RAGError` when module is not initialized, text is empty, or embedding generation fails

**Example:**
```typescript
const vector = await rag.embed({ text: 'Hello world' });
console.log('Vector dimensions:', vector.length); // 768
```

#### save()

```typescript
async save(request: SaveRequest): Promise<boolean>
```

Embeds text and saves it with its vector representation to the specified table.

**Parameters:**
- `request.id` (number): Unique identifier for the text (non-negative integer)
- `request.text` (string): The text content to embed and save
- `request.tablename` (string): Name of the table to store the vector

**Returns:** Promise that resolves to `true` if save was successful, `false` otherwise

**Throws:** `RAGError` when module is not initialized, input validation fails, or save operation fails

**Example:**
```typescript
const success = await rag.save({
  id: 1,
  text: 'Machine learning is a subset of artificial intelligence',
  tablename: 'documents'
});
```

#### search()

```typescript
async search(request: SearchRequest): Promise<number[]>
```

Embeds the query text and searches for the most semantically similar texts in the specified table.

**Parameters:**
- `request.text` (string): The query text to search for similar content
- `request.tablename` (string): Name of the table to search in
- `request.qty` (number): Number of closest matches to return (1-1000)

**Returns:** Promise that resolves to an array of IDs representing the closest matches, ordered from most to least similar

**Throws:** `RAGError` when module is not initialized, input validation fails, or search operation fails

**Example:**
```typescript
const results = await rag.search({
  text: 'artificial intelligence and neural networks',
  tablename: 'documents',
  qty: 5
});
console.log('Similar document IDs:', results); // [1, 3, 7, 2, 9]
```

#### close()

```typescript
async close(): Promise<void>
```

Closes the RAG module by disposing of the embedding model and closing database connections.

**Returns:** Promise that resolves when cleanup is complete

**Throws:** `RAGError` when resource cleanup fails

**Example:**
```typescript
await rag.close();
```

## HybridRAGModule

Advanced RAG system that combines MySQL for document storage with SQLite vector search.

### Constructor

```typescript
new HybridRAGModule(config: HybridRAGConfig)
```

Creates a new HybridRAGModule instance with MySQL and vector database configuration.

**Parameters:**
- `config`: Configuration object including MySQL connection details

**Example:**
```typescript
const hybridRAG = new HybridRAGModule({
  modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
  databasePath: './vectors.db',
  mysql: {
    host: 'localhost',
    user: 'username',
    password: 'password',
    database: 'documents'
  }
});
```

### Methods

#### initialize()

```typescript
async initialize(): Promise<void>
```

Initializes both MySQL and vector databases along with the embedding model.

**Returns:** Promise that resolves when initialization is complete

**Throws:** `RAGError` when initialization fails

#### saveDocument()

```typescript
async saveDocument(request: SaveDocumentRequest): Promise<number>
```

Saves a document to MySQL and its embedding to the vector database.

**Parameters:**
- `request.title` (optional string): Document title
- `request.content` (string): Document content to embed and save
- `request.metadata` (optional any): Additional metadata to store
- `request.tablename` (string): Name of the table to store the document

**Returns:** Promise that resolves to the document ID

**Throws:** `RAGError` when save operation fails

**Example:**
```typescript
const docId = await hybridRAG.saveDocument({
  title: 'AI Research Paper',
  content: 'Artificial intelligence research focuses on...',
  metadata: {
    author: 'Dr. Smith',
    category: 'AI',
    tags: ['machine learning', 'research']
  },
  tablename: 'research_papers'
});
```

#### searchDocuments()

```typescript
async searchDocuments(request: HybridSearchRequest): Promise<SearchResult[]>
```

Searches for similar documents using vector similarity and returns full document data.

**Parameters:**
- `request.text` (string): Query text for similarity search
- `request.tablename` (string): Table name to search in
- `request.qty` (number): Number of results to return
- `request.includeContent` (optional boolean): Whether to include document content (default: true)
- `request.includeMetadata` (optional boolean): Whether to include metadata (default: true)

**Returns:** Promise that resolves to an array of SearchResult objects

**Example:**
```typescript
const results = await hybridRAG.searchDocuments({
  text: 'artificial intelligence research',
  tablename: 'research_papers',
  qty: 5,
  includeContent: true,
  includeMetadata: true
});
```

#### updateDocument()

```typescript
async updateDocument(
  tablename: string, 
  id: number, 
  updates: Partial<DocumentRecord>
): Promise<boolean>
```

Updates a document in MySQL and regenerates its embedding if content changed.

**Parameters:**
- `tablename` (string): Table name containing the document
- `id` (number): Document ID to update
- `updates` (object): Fields to update

**Returns:** Promise that resolves to `true` if update was successful

#### deleteDocument()

```typescript
async deleteDocument(tablename: string, id: number): Promise<boolean>
```

Deletes a document from both MySQL and vector database.

**Parameters:**
- `tablename` (string): Table name containing the document
- `id` (number): Document ID to delete

**Returns:** Promise that resolves to `true` if deletion was successful

#### getDocument()

```typescript
async getDocument(tablename: string, id: number): Promise<DocumentRecord | null>
```

Retrieves a specific document by ID from MySQL.

**Parameters:**
- `tablename` (string): Table name containing the document
- `id` (number): Document ID to retrieve

**Returns:** Promise that resolves to the document or `null` if not found

#### embed()

```typescript
async embed(request: EmbedRequest): Promise<number[]>
```

Utility method to generate embeddings (same as RAGModule.embed).

#### close()

```typescript
async close(): Promise<void>
```

Closes all database connections and cleans up resources.

## Type Definitions

### Configuration Types

```typescript
interface RAGModuleConfig {
  modelPath?: string;        // Path to embedding model file
  databasePath?: string;     // Path to SQLite database file
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

interface HybridRAGConfig extends RAGModuleConfig {
  mysql: MySQLConfig;
}

interface MySQLConfig {
  host: string;
  port?: number;             // Default: 3306
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;  // Default: 10
}
```

### Request Types

```typescript
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

interface SaveDocumentRequest {
  title?: string;
  content: string;
  metadata?: any;
  tablename: string;
}

interface HybridSearchRequest extends SearchRequest {
  includeContent?: boolean;
  includeMetadata?: boolean;
}
```

### Response Types

```typescript
interface SearchResult {
  id: number;
  title?: string;
  content: string;
  metadata?: any;
  similarity_score?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface DocumentRecord {
  id: number;
  title?: string;
  content: string;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}
```

## Error Handling

### RAGError Class

```typescript
class RAGError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public cause?: Error
  )
}
```

### Error Codes

```typescript
enum ErrorCodes {
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  TABLE_CREATION_FAILED = 'TABLE_CREATION_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  VECTOR_SAVE_FAILED = 'VECTOR_SAVE_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
  INVALID_INPUT = 'INVALID_INPUT'
}
```

### Error Handling Example

```typescript
try {
  const results = await rag.search({
    text: 'query',
    tablename: 'documents',
    qty: 5
  });
} catch (error) {
  if (error instanceof RAGError) {
    console.error('RAG Error:', error.message);
    console.error('Error Code:', error.code);
    if (error.cause) {
      console.error('Caused by:', error.cause.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Examples

### Basic Workflow

```typescript
import { RAGModule } from 'nodejs-rag-module';

async function basicExample() {
  const rag = new RAGModule({
    modelPath: './nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: './example.db'
  });

  try {
    // Initialize
    await rag.initialize();

    // Save documents
    await rag.save({
      id: 1,
      text: 'Machine learning algorithms learn from data',
      tablename: 'knowledge'
    });

    await rag.save({
      id: 2,
      text: 'Neural networks are inspired by biological neurons',
      tablename: 'knowledge'
    });

    // Search for similar content
    const results = await rag.search({
      text: 'learning algorithms',
      tablename: 'knowledge',
      qty: 2
    });

    console.log('Similar documents:', results); // [1, 2]

    // Generate embedding
    const vector = await rag.embed({
      text: 'artificial intelligence'
    });

    console.log('Vector dimensions:', vector.length); // 768

  } finally {
    await rag.close();
  }
}
```

### Hybrid RAG Example

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

  try {
    await hybridRAG.initialize();

    // Save document with metadata
    const docId = await hybridRAG.saveDocument({
      title: 'Introduction to AI',
      content: 'Artificial intelligence is the simulation of human intelligence...',
      metadata: {
        author: 'John Doe',
        category: 'Technology',
        tags: ['AI', 'Machine Learning']
      },
      tablename: 'articles'
    });

    // Search with full document data
    const results = await hybridRAG.searchDocuments({
      text: 'artificial intelligence',
      tablename: 'articles',
      qty: 5,
      includeContent: true,
      includeMetadata: true
    });

    console.log('Search results:', results);

    // Update document
    await hybridRAG.updateDocument('articles', docId, {
      content: 'Updated content about artificial intelligence...',
      metadata: { ...results[0].metadata, updated: true }
    });

    // Get specific document
    const document = await hybridRAG.getDocument('articles', docId);
    console.log('Retrieved document:', document);

  } finally {
    await hybridRAG.close();
  }
}
```

### Error Handling Example

```typescript
async function errorHandlingExample() {
  const rag = new RAGModule();

  try {
    await rag.initialize();

    // This will throw an error if the table doesn't exist
    const results = await rag.search({
      text: 'query',
      tablename: 'nonexistent_table',
      qty: 5
    });

  } catch (error) {
    if (error instanceof RAGError) {
      switch (error.code) {
        case ErrorCodes.SEARCH_FAILED:
          console.error('Search operation failed:', error.message);
          break;
        case ErrorCodes.DATABASE_CONNECTION_FAILED:
          console.error('Database connection issue:', error.message);
          break;
        default:
          console.error('RAG error:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await rag.close();
  }
}
```

---

For more examples and use cases, see the [README.md](./README.md) file.
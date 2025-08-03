export interface RAGModuleConfig {
  modelPath?: string;
  databasePath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface EmbedRequest {
  text: string;
}

export interface SaveRequest {
  id: number;
  text: string;
  tablename: string;
}

export interface SearchRequest {
  text: string;
  tablename: string;
  qty: number;
}

export interface EmbeddingService {
  initialize(modelPath: string): Promise<void>;
  embed(text: string): Promise<number[]>;
  isInitialized(): boolean;
  close(): Promise<void>;
}

export interface DatabaseService {
  initialize(databasePath: string): Promise<void>;
  createTableIfNotExists(tablename: string): Promise<void>;
  insertVector(tablename: string, id: number, vector: number[]): Promise<boolean>;
  searchSimilar(tablename: string, queryVector: number[], limit: number): Promise<number[]>;
  close(): Promise<void>;
}

export interface VectorSearchService {
  search(tablename: string, queryVector: number[], limit: number, dbService: DatabaseService): Promise<number[]>;
}

export interface ModelInfo {
  path: string;
  isLoaded: boolean;
  dimensions: number;
}

export interface DatabaseInfo {
  path: string;
  isConnected: boolean;
  tables: string[];
}
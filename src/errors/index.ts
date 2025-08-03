export class RAGError extends Error {
  constructor(message: string, public code: string, public cause?: Error) {
    super(message);
    this.name = 'RAGError';
  }
}

export enum ErrorCodes {
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  TABLE_CREATION_FAILED = 'TABLE_CREATION_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  VECTOR_SAVE_FAILED = 'VECTOR_SAVE_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
  INVALID_INPUT = 'INVALID_INPUT'
}
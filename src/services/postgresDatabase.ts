import { Pool, PoolClient } from 'pg';
import { RAGError, ErrorCodes } from '../errors/index.js';

export interface PostgreSQLConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    max?: number;
    ssl?: boolean;
}

export interface DocumentRecord {
    id: number;
    title?: string;
    content: string;
    metadata?: any;
    created_at?: Date;
    updated_at?: Date;
}

export class PostgreSQLDatabase {
    private pool: Pool | null = null;
    private config: PostgreSQLConfig;
    private initialized: boolean = false;

    constructor(config: PostgreSQLConfig) {
        this.config = {
            ...config,
            port: config.port || 5432,
            max: config.max || 10
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                max: this.config.max,
                ssl: this.config.ssl
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.initialized = true;
        } catch (error) {
            throw new RAGError(
                `Failed to initialize PostgreSQL database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.DATABASE_CONNECTION_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async createDocumentsTable(tableName: string = 'documents'): Promise<void> {
        if (!this.initialized || !this.pool) {
            throw new RAGError('PostgreSQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS "${tableName}" (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                content TEXT NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS "idx_${tableName}_title" ON "${tableName}" (title);
            CREATE INDEX IF NOT EXISTS "idx_${tableName}_content" ON "${tableName}" USING gin(to_tsvector('english', content));
            CREATE INDEX IF NOT EXISTS "idx_${tableName}_metadata" ON "${tableName}" USING gin(metadata);
            
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            
            DROP TRIGGER IF EXISTS "update_${tableName}_updated_at" ON "${tableName}";
            CREATE TRIGGER "update_${tableName}_updated_at"
                BEFORE UPDATE ON "${tableName}"
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `;

        try {
            await this.pool.query(createTableSQL);
        } catch (error) {
            throw new RAGError(
                `Failed to create table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.TABLE_CREATION_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async insertDocument(
        tableName: string,
        document: Omit<DocumentRecord, 'id' | 'created_at' | 'updated_at'>
    ): Promise<number> {
        if (!this.initialized || !this.pool) {
            throw new RAGError('PostgreSQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const insertSQL = `
            INSERT INTO "${tableName}" (title, content, metadata)
            VALUES ($1, $2, $3)
            RETURNING id
        `;

        try {
            const result = await this.pool.query(insertSQL, [
                document.title || null,
                document.content,
                document.metadata ? JSON.stringify(document.metadata) : null
            ]);

            return result.rows[0].id;
        } catch (error) {
            throw new RAGError(
                `Failed to insert document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.VECTOR_SAVE_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async getDocumentsByIds(tableName: string, ids: number[]): Promise<DocumentRecord[]> {
        if (!this.initialized || !this.pool) {
            throw new RAGError('PostgreSQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        if (ids.length === 0) {
            return [];
        }

        const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
        const selectSQL = `
            SELECT id, title, content, metadata, created_at, updated_at
            FROM "${tableName}"
            WHERE id = ANY($1)
            ORDER BY array_position($1, id)
        `;

        try {
            const result = await this.pool.query(selectSQL, [ids]);

            return result.rows.map((row: any) => ({
                id: row.id,
                title: row.title,
                content: row.content,
                metadata: row.metadata,
                created_at: row.created_at,
                updated_at: row.updated_at
            }));
        } catch (error) {
            throw new RAGError(
                `Failed to get documents by IDs: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.SEARCH_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async updateDocument(
        tableName: string,
        id: number,
        updates: Partial<Omit<DocumentRecord, 'id' | 'created_at' | 'updated_at'>>
    ): Promise<boolean> {
        if (!this.initialized || !this.pool) {
            throw new RAGError('PostgreSQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const updateFields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.title !== undefined) {
            updateFields.push(`title = $${paramIndex++}`);
            values.push(updates.title);
        }
        if (updates.content !== undefined) {
            updateFields.push(`content = $${paramIndex++}`);
            values.push(updates.content);
        }
        if (updates.metadata !== undefined) {
            updateFields.push(`metadata = $${paramIndex++}`);
            values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
        }

        if (updateFields.length === 0) {
            return false;
        }

        values.push(id);
        const updateSQL = `
            UPDATE "${tableName}"
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
        `;

        try {
            const result = await this.pool.query(updateSQL, values);
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            throw new RAGError(
                `Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.VECTOR_SAVE_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async deleteDocument(tableName: string, id: number): Promise<boolean> {
        if (!this.initialized || !this.pool) {
            throw new RAGError('PostgreSQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const deleteSQL = `DELETE FROM "${tableName}" WHERE id = $1`;

        try {
            const result = await this.pool.query(deleteSQL, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            throw new RAGError(
                `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.VECTOR_SAVE_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.initialized = false;
        }
    }
}
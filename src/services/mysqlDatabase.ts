import mysql from 'mysql2/promise';
import { RAGError, ErrorCodes } from '../errors/index.js';

export interface MySQLConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    connectionLimit?: number;
}

export interface DocumentRecord {
    id: number;
    title?: string;
    content: string;
    metadata?: any;
    created_at?: Date;
    updated_at?: Date;
}

export class MySQLDatabase {
    private pool: mysql.Pool | null = null;
    private config: MySQLConfig;
    private initialized: boolean = false;

    constructor(config: MySQLConfig) {
        this.config = {
            ...config,
            connectionLimit: config.connectionLimit || 10
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                port: this.config.port || 3306,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                connectionLimit: this.config.connectionLimit
            });

            // Test connection
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            this.initialized = true;
        } catch (error) {
            throw new RAGError(
                `Failed to initialize MySQL database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCodes.DATABASE_CONNECTION_FAILED,
                error instanceof Error ? error : undefined
            );
        }
    }

    async createDocumentsTable(tableName: string = 'documents'): Promise<void> {
        if (!this.initialized || !this.pool) {
            throw new RAGError('MySQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255),
        content TEXT NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_title (title),
        FULLTEXT idx_content (content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

        try {
            await this.pool.execute(createTableSQL);
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
            throw new RAGError('MySQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const insertSQL = `
      INSERT INTO \`${tableName}\` (title, content, metadata)
      VALUES (?, ?, ?)
    `;

        try {
            const [result] = await this.pool.execute(insertSQL, [
                document.title || null,
                document.content,
                document.metadata ? JSON.stringify(document.metadata) : null
            ]);

            const insertResult = result as mysql.ResultSetHeader;
            return insertResult.insertId;
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
            throw new RAGError('MySQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        if (ids.length === 0) {
            return [];
        }

        const placeholders = ids.map(() => '?').join(',');
        const selectSQL = `
      SELECT id, title, content, metadata, created_at, updated_at
      FROM \`${tableName}\`
      WHERE id IN (${placeholders})
      ORDER BY FIELD(id, ${placeholders})
    `;

        try {
            const [rows] = await this.pool.execute(selectSQL, [...ids, ...ids]);
            const documents = rows as any[];

            return documents.map(row => ({
                id: row.id,
                title: row.title,
                content: row.content,
                metadata: row.metadata ? JSON.parse(row.metadata) : null,
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
            throw new RAGError('MySQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const updateFields: string[] = [];
        const values: any[] = [];

        if (updates.title !== undefined) {
            updateFields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.content !== undefined) {
            updateFields.push('content = ?');
            values.push(updates.content);
        }
        if (updates.metadata !== undefined) {
            updateFields.push('metadata = ?');
            values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
        }

        if (updateFields.length === 0) {
            return false;
        }

        values.push(id);
        const updateSQL = `
      UPDATE \`${tableName}\`
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

        try {
            const [result] = await this.pool.execute(updateSQL, values);
            const updateResult = result as mysql.ResultSetHeader;
            return updateResult.affectedRows > 0;
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
            throw new RAGError('MySQL database not initialized', ErrorCodes.DATABASE_CONNECTION_FAILED);
        }

        const deleteSQL = `DELETE FROM \`${tableName}\` WHERE id = ?`;

        try {
            const [result] = await this.pool.execute(deleteSQL, [id]);
            const deleteResult = result as mysql.ResultSetHeader;
            return deleteResult.affectedRows > 0;
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
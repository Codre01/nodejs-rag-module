# Deployment Guide

Complete guide for deploying the Embedding Vector Database (RAG Module) in various environments.

## Table of Contents

- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Performance Optimization](#performance-optimization)
- [Monitoring and Logging](#monitoring-and-logging)
- [Security Considerations](#security-considerations)
- [Scaling Strategies](#scaling-strategies)
- [Troubleshooting](#troubleshooting)

## Production Deployment

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4GB available memory
- **Storage**: 10GB free space (varies by dataset size)
- **Node.js**: Version 16.0.0 or higher
- **Operating System**: Linux (Ubuntu 20.04+), macOS, or Windows Server

#### Recommended Requirements
- **CPU**: 4+ cores, 2.5+ GHz
- **RAM**: 8GB+ available memory
- **Storage**: SSD with 50GB+ free space
- **Network**: Stable internet connection for model downloads
- **Load Balancer**: For high-availability deployments

### Installation Steps

#### 1. Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build essentials (required for native dependencies)
sudo apt-get install -y build-essential python3

# Verify installation
node --version  # Should be 18.x or higher
npm --version
```

#### 2. Application Deployment

```bash
# Create application directory
sudo mkdir -p /opt/rag-module
cd /opt/rag-module

# Clone or copy your application
git clone <your-repository-url> .
# OR
# Copy your built application files

# Install dependencies
npm ci --production

# Create necessary directories
mkdir -p models data logs

# Set proper permissions
sudo chown -R $USER:$USER /opt/rag-module
chmod +x /opt/rag-module
```

#### 3. Model Setup

```bash
# Download embedding model
cd /opt/rag-module/models
wget https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q5_K_M.gguf

# Verify model integrity (optional but recommended)
sha256sum nomic-embed-text-v1.5.Q5_K_M.gguf
```

## Environment Configuration

### Environment Variables

Create a `.env` file for production configuration:

```bash
# .env file
NODE_ENV=production
PORT=3000

# Model Configuration
MODEL_PATH=/opt/rag-module/models/nomic-embed-text-v1.5.Q5_K_M.gguf

# Database Configuration
SQLITE_DB_PATH=/opt/rag-module/data/vectors.db

# MySQL Configuration (for Hybrid RAG)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=rag_user
MYSQL_PASSWORD=secure_password_here
MYSQL_DATABASE=rag_documents
MYSQL_CONNECTION_LIMIT=20

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/opt/rag-module/logs/application.log

# Security
CORS_ORIGIN=https://yourdomain.com
API_KEY=your_secure_api_key_here

# Performance
MAX_CONCURRENT_EMBEDDINGS=10
EMBEDDING_BATCH_SIZE=100
```

### Configuration Management

```typescript
// config/production.ts
export const productionConfig = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  rag: {
    modelPath: process.env.MODEL_PATH || '/opt/rag-module/models/nomic-embed-text-v1.5.Q5_K_M.gguf',
    databasePath: process.env.SQLITE_DB_PATH || '/opt/rag-module/data/vectors.db',
    logLevel: process.env.LOG_LEVEL as LogLevel || 'info'
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'rag_user',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'rag_documents',
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '20')
  }
};
```

## Database Setup

### SQLite Configuration

```bash
# Create data directory with proper permissions
sudo mkdir -p /opt/rag-module/data
sudo chown -R rag-user:rag-user /opt/rag-module/data
chmod 755 /opt/rag-module/data

# Set up SQLite database
sqlite3 /opt/rag-module/data/vectors.db "PRAGMA journal_mode=WAL;"
```

### MySQL Setup (for Hybrid RAG)

```sql
-- Create database and user
CREATE DATABASE rag_documents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'rag_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON rag_documents.* TO 'rag_user'@'localhost';
FLUSH PRIVILEGES;

-- Optimize MySQL for RAG workloads
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL max_connections = 200;
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
```

### Database Backup Strategy

```bash
#!/bin/bash
# backup.sh - Database backup script

BACKUP_DIR="/opt/rag-module/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup SQLite database
cp /opt/rag-module/data/vectors.db $BACKUP_DIR/vectors_$DATE.db

# Backup MySQL database (if using Hybrid RAG)
mysqldump -u rag_user -p rag_documents > $BACKUP_DIR/mysql_$DATE.sql

# Compress backups
gzip $BACKUP_DIR/vectors_$DATE.db
gzip $BACKUP_DIR/mysql_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

## Performance Optimization

### Application-Level Optimization

```typescript
// server.ts - Production server setup
import cluster from 'cluster';
import os from 'os';
import { RAGModule } from './src/index.js';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart worker
  });
} else {
  // Worker process
  const rag = new RAGModule({
    modelPath: process.env.MODEL_PATH,
    databasePath: process.env.SQLITE_DB_PATH,
    logLevel: 'info'
  });

  // Initialize once per worker
  rag.initialize().then(() => {
    console.log(`Worker ${process.pid} started`);
    startServer(rag);
  });
}
```

### Memory Management

```typescript
// memory-manager.ts
export class MemoryManager {
  private static instance: MemoryManager;
  private memoryThreshold = 0.8; // 80% memory usage threshold

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = usage.heapUsed + usage.external;
    const memoryRatio = usedMemory / totalMemory;

    if (memoryRatio > this.memoryThreshold) {
      console.warn('High memory usage detected:', {
        used: Math.round(usedMemory / 1024 / 1024) + 'MB',
        total: Math.round(totalMemory / 1024 / 1024) + 'MB',
        ratio: Math.round(memoryRatio * 100) + '%'
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }
}
```

### Caching Strategy

```typescript
// cache.ts
import NodeCache from 'node-cache';

export class EmbeddingCache {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour TTL
      maxKeys: 10000, // Maximum 10k cached embeddings
      useClones: false // Don't clone objects for better performance
    });
  }

  get(text: string): number[] | undefined {
    const key = this.generateKey(text);
    return this.cache.get(key);
  }

  set(text: string, embedding: number[]): void {
    const key = this.generateKey(text);
    this.cache.set(key, embedding);
  }

  private generateKey(text: string): string {
    // Use first 100 chars + length as cache key
    return text.substring(0, 100) + '_' + text.length;
  }

  getStats() {
    return this.cache.getStats();
  }
}
```

## Monitoring and Logging

### Application Monitoring

```typescript
// monitoring.ts
import { EventEmitter } from 'events';

export class RAGMonitor extends EventEmitter {
  private metrics = {
    embeddings: 0,
    searches: 0,
    saves: 0,
    errors: 0,
    avgEmbeddingTime: 0,
    avgSearchTime: 0
  };

  recordEmbedding(duration: number): void {
    this.metrics.embeddings++;
    this.updateAverage('avgEmbeddingTime', duration);
    this.emit('embedding', { duration, count: this.metrics.embeddings });
  }

  recordSearch(duration: number, resultCount: number): void {
    this.metrics.searches++;
    this.updateAverage('avgSearchTime', duration);
    this.emit('search', { duration, resultCount, count: this.metrics.searches });
  }

  recordError(error: Error): void {
    this.metrics.errors++;
    this.emit('error', { error, count: this.metrics.errors });
  }

  getMetrics() {
    return { ...this.metrics };
  }

  private updateAverage(key: keyof typeof this.metrics, newValue: number): void {
    const current = this.metrics[key] as number;
    const count = this.metrics.embeddings + this.metrics.searches;
    this.metrics[key] = (current * (count - 1) + newValue) / count;
  }
}
```

### Health Check Endpoint

```typescript
// health.ts
export async function healthCheck(rag: RAGModule) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      model: false,
      database: false,
      memory: false
    },
    metrics: {}
  };

  try {
    // Test embedding generation
    const testVector = await rag.embed({ text: 'health check' });
    health.checks.model = testVector.length === 768;

    // Test database connection
    await rag.save({
      id: -1,
      text: 'health check',
      tablename: 'health_check'
    });
    health.checks.database = true;

    // Check memory usage
    const memUsage = process.memoryUsage();
    health.checks.memory = memUsage.heapUsed < 2 * 1024 * 1024 * 1024; // < 2GB
    health.metrics = memUsage;

  } catch (error) {
    health.status = 'unhealthy';
    health.checks.model = false;
    health.checks.database = false;
  }

  return health;
}
```

### Logging Configuration

```typescript
// logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: '/opt/rag-module/logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: '/opt/rag-module/logs/application.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

## Security Considerations

### API Security

```typescript
// security.ts
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiting
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// Security headers
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
});

// API key authentication
export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}
```

### File System Security

```bash
# Set proper file permissions
sudo chown -R rag-user:rag-user /opt/rag-module
chmod 750 /opt/rag-module
chmod 640 /opt/rag-module/.env
chmod 600 /opt/rag-module/data/*.db
chmod 644 /opt/rag-module/models/*.gguf
```

## Scaling Strategies

### Horizontal Scaling

```yaml
# docker-compose.yml
version: '3.8'
services:
  rag-app:
    build: .
    ports:
      - "3000-3003:3000"
    environment:
      - NODE_ENV=production
      - MODEL_PATH=/app/models/nomic-embed-text-v1.5.Q5_K_M.gguf
    volumes:
      - ./models:/app/models:ro
      - ./data:/app/data
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - rag-app
```

### Load Balancer Configuration

```nginx
# nginx.conf
upstream rag_backend {
    least_conn;
    server rag-app:3000 max_fails=3 fail_timeout=30s;
    server rag-app:3001 max_fails=3 fail_timeout=30s;
    server rag-app:3002 max_fails=3 fail_timeout=30s;
    server rag-app:3003 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://rag_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /health {
        proxy_pass http://rag_backend/health;
        access_log off;
    }
}
```

## Troubleshooting

### Common Issues

#### 1. Model Loading Failures

```bash
# Check model file integrity
ls -la /opt/rag-module/models/
file /opt/rag-module/models/nomic-embed-text-v1.5.Q5_K_M.gguf

# Check permissions
ls -la /opt/rag-module/models/

# Test model loading
node -e "
const { RAGModule } = require('./dist/index.js');
const rag = new RAGModule({ modelPath: './models/nomic-embed-text-v1.5.Q5_K_M.gguf' });
rag.initialize().then(() => console.log('Model loaded successfully')).catch(console.error);
"
```

#### 2. Database Connection Issues

```bash
# Check SQLite database
sqlite3 /opt/rag-module/data/vectors.db ".tables"

# Check MySQL connection
mysql -u rag_user -p -h localhost rag_documents -e "SHOW TABLES;"

# Check file permissions
ls -la /opt/rag-module/data/
```

#### 3. Memory Issues

```bash
# Monitor memory usage
top -p $(pgrep -f "node.*rag")

# Check for memory leaks
node --inspect=0.0.0.0:9229 dist/index.js

# Increase Node.js memory limit
node --max-old-space-size=4096 dist/index.js
```

### Debugging Commands

```bash
# Check application logs
tail -f /opt/rag-module/logs/application.log

# Monitor system resources
htop

# Check network connections
netstat -tulpn | grep :3000

# Test API endpoints
curl -X POST http://localhost:3000/embed \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"text": "test embedding"}'
```

### Performance Tuning

```bash
# Optimize SQLite
sqlite3 /opt/rag-module/data/vectors.db "PRAGMA optimize;"

# Monitor database performance
sqlite3 /opt/rag-module/data/vectors.db "PRAGMA compile_options;"

# Check MySQL performance
mysql -u rag_user -p -e "SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool%';"
```

---

For additional support, please refer to the [troubleshooting section](./README.md#troubleshooting) in the main documentation or create an issue on GitHub.
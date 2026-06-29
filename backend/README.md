Phase 3 → SSE streaming
Phase 4 → Redis caching  
Phase 5 → GitHub MCP
Phase 6 → React frontend
Phase 7 → Google OAuth
Phase 8 → Docker + CI/CD + AWS



Backend deep-dives
├── Database indexing       → query optimization, EXPLAIN ANALYZE
├── Connection pooling      → pgBouncer, SQLAlchemy pool tuning  
├── Rate limiting           → Redis-based, per user per minute
├── Background jobs         → Celery + RabbitMQ (async tasks)
└── API versioning          → /api/v1 → /api/v2 migration

Infrastructure
├── Nginx                   → reverse proxy, load balancing, SSL
├── Docker multi-stage      → smaller production images
├── CI/CD                   → GitHub Actions → auto deploy
└── AWS                     → ECS, RDS, ElastiCache, CloudFront

Observability (very FAANG)
├── Structured logging      → structlog, log levels
├── Health checks           → /health endpoint with DB + Redis status
└── Metrics                 → request count, latency, error rate

Security (very FAANG)
├── CORS properly           → not wildcard *
├── Input sanitization      → SQL injection prevention
├── Token refresh           → access + refresh token pattern
└── Google OAuth            → production auth pattern
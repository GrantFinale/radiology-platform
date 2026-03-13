# Radiology Interoperability Platform (RIP)

The Radiology Interoperability Platform is a self-contained, portable system that receives radiology orders from heterogeneous sources -- HL7v2 feeds, FHIR R4 APIs, faxes, and EMR portals -- normalizes them into a canonical data model, enriches them with insurance and scheduling metadata via NLP-powered extraction, and delivers schedule-ready order bundles to downstream RIS/PACS systems. It features a human-in-the-loop review workflow for low-confidence extractions, comprehensive audit logging, and runs entirely via Docker Compose on any machine.

## Architecture Overview

RIP follows a microservices architecture organized as an npm workspaces monorepo. Five backend services communicate over a Redis message bus, with PostgreSQL for persistence, MinIO for document storage, and a React SPA for human review workflows.

For the full architecture document, including data flow diagrams and security details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Launch

```bash
# Clone the repository
git clone <repository-url> radiology-platform
cd radiology-platform

# Configure environment
cp .env.example .env

# Build and start all services
docker compose up --build
```

### Access

| Interface | URL | Default Credentials |
|-----------|-----|---------------------|
| Review UI | [http://localhost:3005](http://localhost:3005) | admin / admin123 |
| API Gateway | [http://localhost:3000](http://localhost:3000) | admin / admin123 |
| Grafana | [http://localhost:3100](http://localhost:3100) | admin / admin123 |
| MinIO Console | [http://localhost:9001](http://localhost:9001) | minioadmin / minio_secret |

## Service Overview

| Service | Port | Language | Description |
|---------|------|----------|-------------|
| api-gateway | 3000 | TypeScript | JWT authentication, request routing, rate limiting, request logging |
| order-service | 3001 | TypeScript | Order CRUD, state machine, validation rules, scheduling readiness checks |
| document-service | 3002 | TypeScript | File upload, OCR via Tesseract, MinIO storage, document lifecycle |
| nlp-service | 3003 | Python | Named-entity recognition, CPT/ICD mapping, confidence scoring |
| integration-service | 3004 | TypeScript | Inbound HL7v2 parsing, outbound FHIR bundle generation, webhook dispatch |
| review-ui | 3005 | React/TS | Human-in-the-loop review queue, document viewer, audit trail |
| postgres | 5432 | -- | PostgreSQL 16 relational database |
| redis | 6379 | -- | Redis 7 message bus, job queues, and cache |
| minio | 9000 | -- | S3-compatible object storage for documents and backups |

## Development

For local development with hot reloading and debug ports:

```bash
# Start the development environment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Or use the Makefile shortcut
make dev
```

The development compose override mounts source directories as volumes and enables watch mode for automatic rebuilds on code changes.

### Useful Make Targets

```bash
make dev            # Start dev environment with hot reload
make test           # Run all tests
make test-unit      # Run unit tests only
make lint           # Run ESLint across all workspaces
make typecheck      # Run TypeScript type checking
make migrate        # Run database migrations
make seed           # Seed database with sample data
make db-shell       # Open a PostgreSQL shell
make help           # Show all available targets
```

## API Documentation

Full API contracts, request/response schemas, and endpoint specifications are documented in [docs/api-contracts.md](docs/api-contracts.md).

The API Gateway exposes all endpoints under `/api/v1/`. Each service also provides:

- `GET /health` -- Health check endpoint
- `GET /metrics` -- Prometheus-compatible metrics

## Integration Guide

RIP accepts orders from multiple source formats. Below are the primary integration paths.

### HL7v2

Send HL7v2 ORM messages to the integration service:

```bash
# Via HTTP
curl -X POST http://localhost:3000/api/integrations/hl7/receive \
  -H "Content-Type: application/hl7-v2" \
  -H "Authorization: Bearer <token>" \
  -d @order-message.hl7

# Via MLLP (direct TCP connection on port 2575)
# Connect to localhost:2575 using any MLLP-compatible client
```

### FHIR R4

Submit FHIR R4 ServiceRequest resources:

```bash
curl -X POST http://localhost:3000/api/integrations/fhir/ServiceRequest \
  -H "Content-Type: application/fhir+json" \
  -H "Authorization: Bearer <token>" \
  -d @service-request.json
```

### Email

Configure IMAP polling in your `.env` file:

```env
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_USER=orders@example.com
IMAP_PASSWORD=your-password
IMAP_TLS=true
IMAP_POLL_INTERVAL_MS=60000
```

The integration service will poll the mailbox and ingest attached documents (PDFs, images) through the document processing pipeline.

### Fax

Configure your fax provider (e.g., Twilio Fax, RingCentral) to send incoming fax webhooks to:

```
POST http://<your-host>:3000/api/integrations/fax/webhook
```

The webhook payload should include the fax document URL. The platform will download, OCR, and process the faxed document automatically.

## Order Lifecycle

Every order progresses through a defined state machine:

```
RECEIVED --> NORMALIZED --> VALIDATED --> SCHEDULED --> COMPLETED
                              |
                              +--> PENDING_REVIEW --> VALIDATED
                                        |
                                        +--> REJECTED
```

1. **RECEIVED** -- Order arrives from any source; raw data is persisted.
2. **NORMALIZED** -- Fields are mapped to the canonical data model. For unstructured sources, OCR and NLP extraction run automatically.
3. **VALIDATED** -- All required fields are present and confidence scores meet the threshold (default: 0.85). Orders below the threshold enter PENDING_REVIEW.
4. **PENDING_REVIEW** -- Assigned to a human reviewer in the Review UI. The reviewer sees the source document alongside extracted fields.
5. **VALIDATED** -- Reviewer confirms or corrects the extracted data.
6. **SCHEDULED** -- Outbound HL7v2/FHIR bundle delivered to downstream RIS/PACS.
7. **COMPLETED** -- Downstream system confirms scheduling.
8. **REJECTED** -- Order cannot be processed (missing critical information, duplicate, etc.).

## Testing

```bash
# Run all tests
make test

# Unit tests only
make test-unit

# Integration tests (requires running services)
make test-integration

# Run linting and type checking
make lint
make typecheck
```

## Security

RIP is designed for environments handling Protected Health Information (PHI) and implements defense-in-depth:

- **Encryption in transit**: TLS 1.3 between all services
- **Encryption at rest**: PostgreSQL column-level encryption (AES-256-GCM), MinIO server-side encryption (SSE-S3)
- **Authentication**: JWT-based API access with configurable expiry
- **Authorization**: Role-based access control (admin, reviewer, operator, integration) with facility-level isolation
- **Audit logging**: Every data access and state transition is recorded with actor, timestamp, and before/after snapshots
- **PHI minimization**: Logs reference resource IDs only, NLP receives de-identified text, session timeouts enforce idle lockout
- **Document retention**: Configurable auto-deletion of raw documents (default: 90 days)

For the complete security model, threat assessment, and compliance considerations, see [docs/security.md](docs/security.md).

## Project Structure

```
radiology-platform/
├── apps/
│   └── review-ui/             # React SPA for human review workflows
├── packages/
│   └── shared/                # Shared TypeScript types, utils, constants
├── services/
│   ├── api-gateway/           # Express gateway - auth, routing, rate limits
│   ├── order-service/         # Order lifecycle management
│   ├── document-service/      # Document ingestion, OCR, storage
│   ├── nlp-service/           # Python - NLP extraction and procedure mapping
│   └── integration-service/   # HL7v2/FHIR adapters, webhook dispatch
├── docker/
│   ├── alertmanager/          # Alertmanager configuration
│   ├── grafana/               # Grafana dashboards and datasources
│   └── prometheus/            # Prometheus scrape configuration
├── docs/
│   ├── api-contracts.md       # API endpoint specifications
│   └── domain-model.md        # Domain model documentation
├── docker-compose.yml         # Production compose file
├── docker-compose.dev.yml     # Development overrides (hot reload, debug ports)
├── Makefile                   # Common development and operations tasks
└── package.json               # Monorepo root with npm workspaces
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

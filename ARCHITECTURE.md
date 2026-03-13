# Radiology Interoperability Platform — Architecture

## System Overview

The Radiology Interoperability Platform (RIP) is a self-contained, portable system that
receives radiology orders from heterogeneous sources (HL7v2 feeds, FHIR APIs, faxes,
EMR portals), normalizes them into a canonical data model, enriches them with insurance
and scheduling metadata, and delivers schedule-ready order bundles to downstream RIS/PACS
systems.

### Goals

| Goal | Measure |
|------|---------|
| Accept orders from any source format | HL7v2, FHIR R4, PDF/fax, CSV, direct API |
| Normalize to a single canonical model | 100 % of orders map to `Order` entity |
| Extract data from unstructured documents | OCR + NLP pipeline with confidence scores |
| Surface ambiguities for human review | Review queue with SLA tracking |
| Deliver schedule-ready bundles | Outbound HL7v2/FHIR with all required fields |
| Run anywhere Docker runs | Single `docker compose up` to start |
| Protect PHI end-to-end | Encryption at rest and in transit, audit log |

---

## Architecture Diagram

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                   External Sources                      │
                          │  EMR (HL7v2)   FHIR Server   Fax/PDF   Portal (REST)   │
                          └────────┬──────────┬────────────┬───────────┬────────────┘
                                   │          │            │           │
                          ┌────────▼──────────▼────────────▼───────────▼────────────┐
                          │                    API Gateway (:3000)                   │
                          │          Authentication · Rate Limiting · Routing        │
                          └──┬──────────┬──────────────┬───────────────┬────────────┘
                             │          │              │               │
               ┌─────────────▼──┐  ┌───▼──────────┐  │  ┌────────────▼────────────┐
               │ Order Service  │  │  Document     │  │  │  Integration Service    │
               │   (:3001)      │  │  Service      │  │  │   (:3004)               │
               │                │  │  (:3002)      │  │  │                         │
               │ • Intake       │  │               │  │  │ • HL7v2 parser/builder  │
               │ • Normalize    │  │ • Ingest      │  │  │ • FHIR R4 client        │
               │ • Validate     │  │ • OCR         │  │  │ • Webhook dispatch      │
               │ • Lifecycle    │  │ • Store       │  │  │ • Outbound delivery     │
               └───────┬───────┘  └───┬───────────┘  │  └────────────┬────────────┘
                       │              │               │               │
                       │         ┌────▼────────┐      │               │
                       │         │ NLP Service │      │               │
                       │         │  (:3003)    │      │               │
                       │         │  Python     │      │               │
                       │         │ • Entity    │      │               │
                       │         │   extract   │      │               │
                       │         │ • Procedure │      │               │
                       │         │   mapping   │      │               │
                       │         │ • Confidence│      │               │
                       │         │   scoring   │      │               │
                       │         └─────────────┘      │               │
                       │              │               │               │
          ┌────────────▼──────────────▼───────────────▼───────────────▼──┐
          │                        Message Bus (Redis)                    │
          │              Queues · Pub/Sub · Rate Limiting                 │
          └──────┬──────────────┬─────────────────────┬──────────────────┘
                 │              │                     │
          ┌──────▼──────┐ ┌────▼──────┐  ┌───────────▼──────────┐
          │ PostgreSQL  │ │  MinIO    │  │   Review UI (:3005)  │
          │  (:5432)    │ │ (:9000)   │  │   React SPA          │
          │             │ │           │  │                      │
          │ • Orders    │ │ • PDFs    │  │ • Review queue       │
          │ • Patients  │ │ • Faxes   │  │ • Order details      │
          │ • Audit log │ │ • Images  │  │ • Document viewer    │
          │ • Tasks     │ │ • HL7 raw │  │ • Audit trail        │
          └─────────────┘ └───────────┘  └──────────────────────┘
```

---

## Service Decomposition

The codebase is a **monorepo** managed with npm workspaces.

```
radiology-platform/
├── packages/
│   └── shared/            # Shared TypeScript types, utils, constants
├── services/
│   ├── api-gateway/       # Express gateway — auth, routing, rate limits
│   ├── order-service/     # Order lifecycle management
│   ├── document-service/  # Document ingestion, OCR orchestration, storage
│   ├── nlp-service/       # Python — NLP extraction and procedure mapping
│   └── integration-service/ # HL7v2/FHIR adapters, webhook dispatch
├── apps/
│   └── review-ui/         # React SPA for human review workflows
├── docker-compose.yml
├── docker-compose.dev.yml
└── Makefile
```

### Service Responsibilities

| Service | Language | Port | Responsibility |
|---------|----------|------|----------------|
| api-gateway | TypeScript | 3000 | JWT auth, request routing, rate limiting, request logging |
| order-service | TypeScript | 3001 | Order CRUD, state machine, validation rules, scheduling readiness checks |
| document-service | TypeScript | 3002 | File upload, OCR via Tesseract, MinIO storage, document lifecycle |
| nlp-service | Python | 3003 | Named-entity recognition, CPT/ICD mapping, confidence scoring |
| integration-service | TypeScript | 3004 | Inbound HL7v2 parsing, outbound FHIR bundle generation, webhook management |
| review-ui | React/TS | 3005 | Human-in-the-loop review queue, document viewer, audit trail |

---

## Data Flow

### Order Intake → Scheduling Readiness

```
1. RECEIVE
   Source sends order via HL7v2 / FHIR / REST / fax upload.
   API Gateway authenticates, routes to appropriate service.

2. INGEST
   a) Structured data → Order Service creates Order (state: RECEIVED).
   b) Unstructured data → Document Service ingests file, triggers OCR.
      OCR text → NLP Service extracts entities → Order Service creates Order.

3. INTERPRET
   NLP Service maps free-text procedure descriptions to CPT codes,
   extracts patient demographics, insurance info, and clinical indications.
   Each extraction carries a confidence score (0.0–1.0).

4. NORMALIZE
   Order Service merges extracted fields into canonical Order model.
   Runs validation rules (required fields, code lookups, insurance eligibility).
   State → NORMALIZED.

5. VALIDATE
   If all required fields present and confidence ≥ threshold (default 0.85):
     State → VALIDATED (auto-approved).
   Else:
     ReviewTask created, assigned to human reviewer.
     State → PENDING_REVIEW.

6. HUMAN REVIEW (if needed)
   Reviewer sees order + source document side-by-side in Review UI.
   Corrects/confirms extracted fields. State → VALIDATED.

7. SCHEDULE-READY
   Integration Service builds outbound HL7v2 ORM/FHIR ServiceRequest.
   Delivers to downstream RIS. State → SCHEDULED.

8. COMPLETE
   Downstream confirms scheduling. State → COMPLETED.
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Services (backend) | Node.js 20 / TypeScript 5 | Type safety, large ecosystem, fast iteration |
| NLP | Python 3.11 / spaCy / scikit-learn | Best-in-class NLP libraries, medical NER models |
| OCR | Tesseract 5 (via tesseract.js + native) | Open-source, no cloud dependency, HIPAA-safe |
| Database | PostgreSQL 16 | ACID, JSONB for flexible schemas, full-text search |
| Queue / Cache | Redis 7 | BullMQ job queues, pub/sub for events, session cache |
| Object Storage | MinIO | S3-compatible, self-hosted, stores PHI locally |
| Frontend | React 18 / Vite / TailwindCSS | Modern SPA tooling, fast builds |
| API Framework | Express 4 | Mature, well-understood, extensive middleware |
| ORM | Prisma | Type-safe database access, migrations |
| Containerization | Docker / Docker Compose | Portable, reproducible, single-command startup |

---

## Security & PHI Handling

### Encryption

| Scope | Mechanism |
|-------|-----------|
| In transit | TLS 1.3 between all services (self-signed certs in dev, proper CA in prod) |
| At rest (database) | PostgreSQL TDE via `pgcrypto`; sensitive columns encrypted with AES-256-GCM |
| At rest (files) | MinIO server-side encryption (SSE-S3) with AES-256 |
| At rest (Redis) | Redis configured with `requirepass`; AOF/RDB files on encrypted volume |

### Authentication & Authorization

- **External API access**: JWT tokens issued by api-gateway. Tokens carry `sub` (user/system ID), `roles`, and `facilities` claims.
- **Inter-service communication**: Shared HMAC secret for service-to-service calls. Each request includes `X-Service-Name` and `X-Request-Signature` headers.
- **RBAC roles**: `admin`, `reviewer`, `operator`, `integration` (machine-to-machine).
- **Facility-level isolation**: Every query is scoped to the caller's permitted facility IDs.

### Audit Logging

Every state transition, data access, and modification is recorded in the `audit_log` table:

```
audit_log (
  id            UUID PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id      UUID NOT NULL,
  actor_type    TEXT NOT NULL,          -- 'user' | 'service' | 'system'
  action        TEXT NOT NULL,          -- 'order.create' | 'document.view' | ...
  resource_type TEXT NOT NULL,          -- 'order' | 'patient' | 'document'
  resource_id   UUID NOT NULL,
  facility_id   UUID,
  details       JSONB,                 -- before/after snapshots
  ip_address    INET
)
```

### PHI Minimization

- Logs never contain raw PHI; they reference resource IDs only.
- NLP Service receives de-identified text where possible (patient name replaced with token).
- Review UI enforces session timeouts (15 min idle) and screen-lock prompts.
- MinIO bucket lifecycle policies auto-delete raw documents after configurable retention period (default 90 days).

---

## Deployment Model

### Production (Docker Compose)

The entire platform runs via a single `docker-compose.yml`. All data is persisted in named Docker volumes. The stack is portable — copy the project directory and `.env` file to any Docker-capable host and run:

```bash
docker compose up -d
```

### Resource Requirements

| Tier | CPU | RAM | Storage |
|------|-----|-----|---------|
| Minimum (dev/demo) | 4 cores | 8 GB | 20 GB |
| Recommended (production) | 8 cores | 16 GB | 100 GB+ |

### Volumes

| Volume | Purpose |
|--------|---------|
| `pg_data` | PostgreSQL data directory |
| `redis_data` | Redis AOF persistence |
| `minio_data` | MinIO object storage |

### Networking

All services communicate over a dedicated Docker bridge network (`rip-network`). Only the API Gateway and Review UI expose ports to the host. Infrastructure services (PostgreSQL, Redis, MinIO) are accessible only from within the Docker network in production.

### Backup Strategy

- PostgreSQL: `pg_dump` via cron container or host cron, stored to MinIO backup bucket.
- MinIO: Bucket replication to external S3-compatible target (configurable).
- Redis: AOF persistence with configurable fsync policy.

### Monitoring

- Health check endpoints on every service (`GET /health`).
- Docker health checks configured in compose file.
- Structured JSON logging to stdout (collected by Docker log driver).
- Prometheus metrics endpoint on each service (`GET /metrics`) for optional Grafana integration.

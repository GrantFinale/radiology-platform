# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-13

### Added

- API Gateway with JWT authentication, rate limiting, and request routing.
- Order Service with full order lifecycle state machine (RECEIVED through COMPLETED).
- Document Service with OCR via Tesseract and MinIO object storage.
- NLP Service (Python/spaCy) for entity extraction, CPT/ICD mapping, and confidence scoring.
- Integration Service with HL7v2 parser/builder, FHIR R4 client, and webhook dispatch.
- Review UI (React SPA) with human-in-the-loop review queue, document viewer, and audit trail.
- Shared packages with canonical TypeScript types, utilities, and constants.
- PostgreSQL 16 for relational data with column-level encryption for PHI.
- Redis 7 for BullMQ job queues, pub/sub events, and session caching.
- MinIO for S3-compatible document and backup storage with lifecycle policies.
- Docker Compose configurations for production and development environments.
- Prometheus, Grafana, and Alertmanager monitoring stack.
- Comprehensive API contracts documentation.
- Domain model documentation.
- Makefile with common development and operations targets.
- Portable bundle script for creating self-contained deployment archives.

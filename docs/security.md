# Security & HIPAA Compliance

## Overview

The Radiology Interoperability Platform handles Protected Health Information (PHI) and must comply with the HIPAA Security Rule, HIPAA Privacy Rule, and HITECH Act. This document outlines the security controls, data handling procedures, and compliance requirements.

## PHI Handling Procedures

### What Constitutes PHI

Under HIPAA, PHI includes any individually identifiable health information:

- Patient names
- Dates (birth, admission, discharge, death)
- Social Security Numbers
- Medical Record Numbers (MRNs)
- Phone and fax numbers
- Email addresses
- Street addresses and ZIP codes
- Health plan beneficiary numbers
- Account numbers
- Certificate/license numbers
- Device identifiers and serial numbers
- IP addresses
- Biometric identifiers
- Full-face photographs
- Any other unique identifying number or code

### PHI in Logs

**PHI MUST NEVER appear in application logs.** All services use the `redactPHI()` utility from `@radiology-platform/shared` to strip PHI from log output before writing. The redaction utility covers:

- Patient names
- SSNs
- MRNs
- Dates of birth
- Phone numbers
- Email addresses
- Street addresses
- IP addresses

Log output is reviewed periodically to verify PHI redaction effectiveness.

### PHI in Error Messages

Error messages returned to clients must not contain PHI. Internal errors should reference entity IDs (UUIDs) rather than patient-identifiable data.

## Encryption at Rest

### PostgreSQL

- All database volumes use filesystem-level encryption (LUKS or equivalent).
- Sensitive columns (SSN, certain demographics) use field-level AES-256-GCM encryption via the `encryptField()` / `decryptField()` utilities in `@radiology-platform/shared`.
- Encryption keys are stored in a dedicated secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault), never in environment variables or source code.
- Database backups are encrypted with the same or stronger algorithms.

### MinIO (Object Storage)

- Server-side encryption (SSE-S3 or SSE-KMS) is enabled for all buckets.
- Document uploads (faxes, scanned PDFs, HL7 messages) are encrypted at rest.
- Encryption keys for MinIO are managed via KMS integration.

### Redis

- Redis instances use TLS for connections.
- Sensitive cached data (e.g., session tokens, temporary PHI) has TTLs to limit exposure.
- Redis persistence files (RDB/AOF) reside on encrypted volumes.

## Encryption in Transit

### TLS Between Services

- All inter-service communication uses TLS 1.2 or higher.
- The API Gateway terminates external TLS and forwards requests internally over mTLS where supported.
- Self-signed certificates are acceptable in development; production uses CA-signed certificates.

### External Integrations

- HL7v2 MLLP connections are wrapped in TLS (HL7 over TLS).
- FHIR REST API calls use HTTPS with certificate validation.
- EMR adapter connections (Epic, Cerner) require TLS with mutual authentication where the EMR mandates it.

## Audit Logging Requirements

### What is Audited

Every access to or modification of PHI generates an audit log entry:

| Action | Logged Fields |
|--------|---------------|
| CREATE | Entity type, entity ID, actor, actor type, timestamp |
| READ / VIEW | Entity type, entity ID, actor, timestamp, IP address |
| UPDATE | Entity type, entity ID, actor, changed fields (old/new values redacted), timestamp |
| DELETE | Entity type, entity ID, actor, reason, timestamp |
| STATUS_CHANGE | Entity type, entity ID, from/to status, actor, timestamp |
| EXPORT | Entity type, entity IDs, export format, actor, timestamp |
| IMPORT | Source system, entity count, actor, timestamp |

### Audit Log Storage

- Audit logs are stored in a dedicated `audit_logs` table in PostgreSQL.
- Audit logs are immutable: no UPDATE or DELETE operations are permitted on the audit table.
- Audit logs are retained for a minimum of 6 years per HIPAA requirements.
- Audit logs are backed up separately and encrypted.

### Audit Log Access

- Only users with the `admin` role can view audit logs.
- Audit log access itself is audited (meta-auditing).

## Access Control (RBAC)

### Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | System administrator | Full access, user management, audit log access, system configuration |
| `reviewer` | Clinical reviewer | View orders, approve/reject orders, view documents, manage review tasks |
| `technician` | Radiology technician | View assigned orders, update order status, view documents |
| `integration` | System integration account | Submit/receive HL7 and FHIR messages, create orders programmatically |

### Permission Matrix

| Resource | admin | reviewer | technician | integration |
|----------|-------|----------|------------|-------------|
| Orders - Create | Yes | No | No | Yes |
| Orders - Read | Yes | Yes | Own facility | Yes |
| Orders - Update | Yes | Yes (review fields) | Status only | Yes |
| Orders - Delete | Yes | No | No | No |
| Patients - Read | Yes | Yes | Own patients | Yes |
| Patients - Write | Yes | No | No | Yes |
| Documents - Read | Yes | Yes | Own facility | Yes |
| Documents - Upload | Yes | Yes | No | Yes |
| Review Tasks - Manage | Yes | Yes | No | No |
| Audit Logs - Read | Yes | No | No | No |
| System Config | Yes | No | No | No |

### Authentication

- API Gateway authenticates all requests using JWT tokens.
- Tokens include user ID, role, and facility ID claims.
- Token expiration: 1 hour for interactive sessions, 24 hours for integration accounts.
- Refresh tokens are rotated on each use and expire after 7 days.

### Session Management

- Sessions are tracked in Redis with TTLs.
- Concurrent session limits: 3 per user (configurable).
- Sessions are invalidated on password change.

## Data Retention Policies

| Data Type | Retention Period | Disposal Method |
|-----------|-----------------|-----------------|
| Active orders | Indefinite (while active) | N/A |
| Completed orders | 7 years | Secure deletion with verification |
| Patient demographics | 7 years after last encounter | Secure deletion with verification |
| Documents (faxes, PDFs) | 7 years | Secure deletion from MinIO + verification |
| HL7/FHIR messages | 3 years | Secure deletion |
| Audit logs | 6 years minimum | Archive to cold storage, then secure deletion |
| Application logs | 90 days | Automatic rotation and deletion |
| Session data | 7 days maximum | Automatic TTL expiration in Redis |
| Temporary processing data | 24 hours | Automatic cleanup job |

### Secure Deletion

- Database records are permanently deleted (not soft-deleted) after the retention period.
- Object storage files are overwritten before deletion where the storage backend supports it.
- Deletion events are recorded in the audit log.

## HIPAA Compliance Checklist

### Administrative Safeguards

- [x] Security Management Process: Risk analysis documented, security measures implemented
- [x] Assigned Security Responsibility: Security officer designated
- [x] Workforce Security: Role-based access, background checks required
- [x] Information Access Management: RBAC implemented, minimum necessary access
- [x] Security Awareness Training: Required for all personnel with PHI access
- [x] Security Incident Procedures: Incident response plan documented
- [x] Contingency Plan: Backup, disaster recovery, and emergency mode procedures
- [x] Evaluation: Periodic security assessments scheduled

### Physical Safeguards

- [x] Facility Access Controls: Cloud provider manages physical security (SOC 2 certified)
- [x] Workstation Use: Policies for workstation security documented
- [x] Device and Media Controls: Encryption required on all devices, secure media disposal

### Technical Safeguards

- [x] Access Control: Unique user IDs, emergency access procedure, automatic logoff, encryption
- [x] Audit Controls: Comprehensive audit logging of all PHI access
- [x] Integrity Controls: Data integrity verification, tamper detection via GCM auth tags
- [x] Transmission Security: TLS 1.2+ for all data in transit

### Breach Notification

- Breach assessment within 24 hours of discovery
- Notification to affected individuals within 60 days
- HHS notification per regulatory requirements
- Documentation of all breach investigations and outcomes

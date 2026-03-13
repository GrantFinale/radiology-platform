# Domain Model

## Core Entities

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Facility   │       │   Provider   │       │InsurancePlan │
│              │       │              │       │              │
│ id           │       │ id           │       │ id           │
│ name         │       │ npi          │       │ payer_id     │
│ address      │◄──┐   │ first_name   │       │ payer_name   │
│ phone        │   │   │ last_name    │       │ plan_name    │
│ fax          │   │   │ specialty    │       │ member_id    │
│ facility_type│   │   │ facility_id  │───┐   │ group_number │
│ npi          │   │   │ phone        │   │   │ effective    │
│ active       │   │   │ fax          │   │   │ termination  │
└──────────────┘   │   │ active       │   │   │ verified     │
                   │   └──────────────┘   │   └──────┬───────┘
                   │                      │          │
                   │   ┌──────────────┐   │          │
                   │   │   Patient    │   │          │
                   │   │              │   │          │
                   │   │ id           │   │          │
                   │   │ mrn          │   │          │
                   │   │ first_name   │   │          │
                   │   │ last_name    │   │          │
                   │   │ dob          │   │          │
                   │   │ sex          │   │          │
                   │   │ ssn_hash     │   │          │
                   │   │ phone        │   │          │
                   │   │ email        │   │          │
                   │   │ address      │   │          │
                   │   └──────┬───────┘   │          │
                   │          │           │          │
                   │   ┌──────▼───────┐   │          │
                   │   │    Order     │   │          │
                   │   │              │   │          │
                   │   │ id           │   │          │
                   │   │ external_id  │   │          │
                   │   │ patient_id   │───┘          │
                   ├───│ facility_id  │              │
                   │   │ ordering_    │              │
                   │   │  provider_id │──────────────┘
                   │   │ procedure_id │───┐
                   │   │ insurance_   │   │
                   │   │  plan_id     │───┘──(to InsurancePlan)
                   │   │ status       │
                   │   │ priority     │
                   │   │ clinical_    │
                   │   │  indication  │
                   │   │ notes        │
                   │   │ source_type  │
                   │   │ source_raw   │
                   │   │ confidence   │
                   │   │ scheduled_at │
                   │   │ created_at   │
                   │   │ updated_at   │
                   │   └──┬───────┬───┘
                   │      │       │
          ┌────────▼──┐   │  ┌────▼────────┐
          │ Document  │   │  │ ReviewTask  │
          │           │   │  │             │
          │ id        │   │  │ id          │
          │ order_id  │───┘  │ order_id    │
          │ type      │      │ document_id │
          │ filename  │      │ assigned_to │
          │ mime_type │      │ status      │
          │ storage_  │      │ task_type   │
          │  key      │      │ priority    │
          │ status    │      │ fields      │
          │ ocr_text  │      │ resolution  │
          │ metadata  │      │ sla_deadline│
          │ created_at│      │ created_at  │
          │ updated_at│      │ completed_at│
          └───────────┘      └─────────────┘

          ┌──────────────┐
          │  Procedure   │
          │              │
          │ id           │
          │ cpt_code     │
          │ description  │
          │ modality     │
          │ body_part    │
          │ contrast     │
          │ prep_required│
          │ duration_min │
          │ active       │
          └──────────────┘
```

---

## Entity Definitions

### Patient

Represents a patient who is the subject of a radiology order.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| mrn | VARCHAR(50) | NOT NULL | Medical record number (facility-scoped) |
| first_name | VARCHAR(100) | NOT NULL, encrypted | Patient first name |
| last_name | VARCHAR(100) | NOT NULL, encrypted | Patient last name |
| dob | DATE | NOT NULL | Date of birth |
| sex | ENUM | NOT NULL | `male`, `female`, `other`, `unknown` |
| ssn_hash | VARCHAR(64) | NULLABLE | SHA-256 hash of SSN (for dedup only) |
| phone | VARCHAR(20) | NULLABLE, encrypted | Primary phone |
| email | VARCHAR(255) | NULLABLE, encrypted | Email address |
| address | JSONB | NULLABLE, encrypted | Structured address object |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(mrn)`, `(last_name, dob)`, `(ssn_hash)`

---

### Order

The central entity. Represents a radiology order from intake through completion.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| external_id | VARCHAR(100) | NULLABLE, UNIQUE | Identifier from source system |
| patient_id | UUID | FK → Patient | Subject of the order |
| facility_id | UUID | FK → Facility, NOT NULL | Ordering/performing facility |
| ordering_provider_id | UUID | FK → Provider | Ordering physician |
| procedure_id | UUID | FK → Procedure | Mapped procedure |
| insurance_plan_id | UUID | FK → InsurancePlan, NULLABLE | Patient's insurance for this order |
| status | ENUM | NOT NULL | Current lifecycle state |
| priority | ENUM | NOT NULL, DEFAULT 'routine' | `stat`, `urgent`, `routine` |
| clinical_indication | TEXT | NULLABLE | Clinical reason for exam |
| icd_codes | VARCHAR(10)[] | NULLABLE | ICD-10 diagnosis codes |
| notes | TEXT | NULLABLE | Free-text notes |
| source_type | ENUM | NOT NULL | `hl7v2`, `fhir`, `fax`, `api`, `csv` |
| source_raw | JSONB | NULLABLE | Raw source payload (reference) |
| confidence_score | DECIMAL(3,2) | NULLABLE | NLP extraction confidence (0.00–1.00) |
| scheduled_at | TIMESTAMPTZ | NULLABLE | Scheduled exam date/time |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(status)`, `(facility_id, status)`, `(patient_id)`, `(external_id)`, `(created_at)`

---

### Provider

A referring or ordering physician.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| npi | VARCHAR(10) | NOT NULL, UNIQUE | National Provider Identifier |
| first_name | VARCHAR(100) | NOT NULL | Provider first name |
| last_name | VARCHAR(100) | NOT NULL | Provider last name |
| specialty | VARCHAR(100) | NULLABLE | Medical specialty |
| facility_id | UUID | FK → Facility | Primary affiliated facility |
| phone | VARCHAR(20) | NULLABLE | Contact phone |
| fax | VARCHAR(20) | NULLABLE | Fax number |
| active | BOOLEAN | NOT NULL, DEFAULT true | Whether provider is active |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(npi)`, `(last_name, first_name)`, `(facility_id)`

---

### Facility

A healthcare facility (clinic, hospital, imaging center).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| name | VARCHAR(200) | NOT NULL | Facility name |
| address | JSONB | NOT NULL | Structured address |
| phone | VARCHAR(20) | NULLABLE | Main phone |
| fax | VARCHAR(20) | NULLABLE | Fax number |
| facility_type | ENUM | NOT NULL | `hospital`, `clinic`, `imaging_center`, `urgent_care` |
| npi | VARCHAR(10) | NULLABLE, UNIQUE | Facility NPI |
| active | BOOLEAN | NOT NULL, DEFAULT true | Whether facility is active |
| timezone | VARCHAR(50) | NOT NULL, DEFAULT 'America/New_York' | Facility timezone |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(name)`, `(npi)`

---

### Procedure

A radiology procedure definition (CPT-based).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| cpt_code | VARCHAR(10) | NOT NULL, UNIQUE | CPT code |
| description | VARCHAR(500) | NOT NULL | Procedure description |
| modality | ENUM | NOT NULL | `xray`, `ct`, `mri`, `us`, `mammo`, `fluoro`, `nuclear`, `pet`, `dexa` |
| body_part | VARCHAR(100) | NOT NULL | Anatomical region |
| contrast | ENUM | NOT NULL, DEFAULT 'none' | `none`, `with`, `without`, `with_and_without` |
| prep_required | BOOLEAN | NOT NULL, DEFAULT false | Whether patient prep is needed |
| duration_minutes | INTEGER | NOT NULL, DEFAULT 30 | Expected exam duration |
| active | BOOLEAN | NOT NULL, DEFAULT true | Whether procedure is orderable |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(cpt_code)`, `(modality)`, `(modality, body_part)`

---

### InsurancePlan

Insurance coverage information for a specific order.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| patient_id | UUID | FK → Patient | Insured patient |
| payer_id | VARCHAR(50) | NOT NULL | Payer identifier |
| payer_name | VARCHAR(200) | NOT NULL | Insurance company name |
| plan_name | VARCHAR(200) | NULLABLE | Specific plan name |
| member_id | VARCHAR(50) | NOT NULL, encrypted | Member/subscriber ID |
| group_number | VARCHAR(50) | NULLABLE | Group number |
| effective_date | DATE | NOT NULL | Coverage start date |
| termination_date | DATE | NULLABLE | Coverage end date |
| plan_type | ENUM | NULLABLE | `hmo`, `ppo`, `epo`, `pos`, `medicare`, `medicaid`, `tricare`, `other` |
| verified | BOOLEAN | NOT NULL, DEFAULT false | Whether eligibility is verified |
| verified_at | TIMESTAMPTZ | NULLABLE | Last verification timestamp |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(patient_id)`, `(payer_id, member_id)`

---

### Document

A file associated with an order (fax, PDF, image, raw HL7 message).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| order_id | UUID | FK → Order, NULLABLE | Associated order (null until linked) |
| type | ENUM | NOT NULL | `fax`, `referral`, `prior_auth`, `clinical_notes`, `insurance_card`, `hl7_raw`, `other` |
| original_filename | VARCHAR(500) | NOT NULL | Original file name |
| mime_type | VARCHAR(100) | NOT NULL | MIME type |
| storage_key | VARCHAR(500) | NOT NULL | MinIO object key |
| storage_bucket | VARCHAR(100) | NOT NULL, DEFAULT 'documents' | MinIO bucket name |
| file_size_bytes | BIGINT | NOT NULL | File size |
| page_count | INTEGER | NULLABLE | Number of pages (for PDFs) |
| status | ENUM | NOT NULL, DEFAULT 'ingested' | Document lifecycle state |
| ocr_text | TEXT | NULLABLE | Extracted OCR text |
| ocr_confidence | DECIMAL(3,2) | NULLABLE | OCR confidence score |
| nlp_extractions | JSONB | NULLABLE | Structured NLP extraction results |
| metadata | JSONB | NULLABLE | Additional metadata |
| created_at | TIMESTAMPTZ | NOT NULL | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last modification time |

**Indexes**: `(order_id)`, `(status)`, `(type)`, `(storage_key)`

---

### ReviewTask

A human review task generated when automated processing needs human confirmation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Internal identifier |
| order_id | UUID | FK → Order, NOT NULL | Order under review |
| document_id | UUID | FK → Document, NULLABLE | Related document |
| assigned_to | UUID | FK → User, NULLABLE | Assigned reviewer |
| status | ENUM | NOT NULL, DEFAULT 'pending' | Task state |
| task_type | ENUM | NOT NULL | Type of review needed |
| priority | ENUM | NOT NULL, DEFAULT 'normal' | `critical`, `high`, `normal`, `low` |
| fields_to_review | JSONB | NOT NULL | Fields needing review with current/suggested values |
| resolution | JSONB | NULLABLE | Reviewer's decisions |
| resolution_notes | TEXT | NULLABLE | Reviewer's free-text notes |
| sla_deadline | TIMESTAMPTZ | NOT NULL | Deadline for review completion |
| created_at | TIMESTAMPTZ | NOT NULL | Task creation time |
| started_at | TIMESTAMPTZ | NULLABLE | When reviewer began work |
| completed_at | TIMESTAMPTZ | NULLABLE | Task completion time |

**Indexes**: `(status, priority)`, `(assigned_to, status)`, `(order_id)`, `(sla_deadline)`

---

## State Machines

### Order Lifecycle

```
                         ┌───────────┐
                         │ RECEIVED  │
                         └─────┬─────┘
                               │
                    ┌──────────▼──────────┐
                    │    INTERPRETED      │
                    │ (NLP extraction     │
                    │  completed)         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    NORMALIZED       │
                    │ (Canonical model    │
                    │  populated)         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    VALIDATED        │◄──────────────┐
                    │ (All required       │               │
                    │  fields confirmed)  │               │
                    └──────────┬──────────┘               │
                               │                          │
              ┌────────────────┼────────────────┐         │
              │ confidence     │ confidence     │         │
              │ ≥ threshold    │ < threshold    │         │
              │                │                │         │
              ▼                ▼                │         │
     ┌────────────┐   ┌───────────────┐        │         │
     │ VALIDATED  │   │PENDING_REVIEW │────────►│         │
     │ (auto)     │   │               │  (reviewer       │
     └──────┬─────┘   └───────────────┘   approves)      │
            │                                             │
            │                ┌────────────────────────────┘
            │                │
     ┌──────▼─────┐          │
     │ SCHEDULED  │          │
     │ (Sent to   │          │
     │  RIS/PACS) │          │
     └──────┬─────┘          │
            │                │
     ┌──────▼─────┐          │
     │ COMPLETED  │          │
     └────────────┘          │
                             │
     ┌────────────┐          │
     │ CANCELLED  │◄─────── (any state except COMPLETED)
     └────────────┘

     ┌────────────┐
     │   ERROR    │◄─────── (any state, on unrecoverable error)
     └────────────┘
```

#### Order State Transition Rules

| From | To | Trigger | Conditions |
|------|----|---------|------------|
| — | RECEIVED | Order created | Valid source, patient identifiable |
| RECEIVED | INTERPRETED | NLP extraction complete | At least one extraction field populated |
| INTERPRETED | NORMALIZED | Canonical mapping done | Procedure mapped, patient linked |
| NORMALIZED | VALIDATED | Auto-validation | All required fields present, confidence >= threshold |
| NORMALIZED | PENDING_REVIEW | Review required | Missing fields OR confidence < threshold |
| PENDING_REVIEW | VALIDATED | Reviewer approves | Reviewer confirms/corrects all flagged fields |
| VALIDATED | SCHEDULED | Outbound delivery sent | Integration service confirms transmission |
| SCHEDULED | COMPLETED | Downstream confirmation | RIS/PACS acknowledges scheduling |
| Any (except COMPLETED) | CANCELLED | Manual cancellation | Authorized user cancels |
| Any | ERROR | System error | Unrecoverable processing failure |

---

### Document Lifecycle

```
     ┌──────────┐
     │ INGESTED │
     │          │
     └────┬─────┘
          │
     ┌────▼──────────┐
     │  PROCESSING   │
     │ (OCR running) │
     └────┬──────────┘
          │
     ┌────▼──────────┐
     │  PROCESSED    │
     │ (OCR done,    │
     │  text ready)  │
     └────┬──────────┘
          │
     ┌────▼──────────┐
     │ INTERPRETED   │
     │ (NLP entities │
     │  extracted)   │
     └────┬──────────┘
          │
     ┌────▼──────────┐         ┌──────────┐
     │   VERIFIED    │         │  FAILED  │
     │ (Human        │         │          │
     │  confirmed)   │         └──────────┘
     └────┬──────────┘              ▲
          │                         │
     ┌────▼──────────┐         (OCR or NLP
     │   ARCHIVED    │          failure)
     │ (Retention    │
     │  policy)      │
     └───────────────┘
```

#### Document State Transition Rules

| From | To | Trigger | Conditions |
|------|----|---------|------------|
| — | INGESTED | File uploaded | Valid file, stored in MinIO |
| INGESTED | PROCESSING | OCR job started | OCR queue picks up document |
| PROCESSING | PROCESSED | OCR complete | Text extracted successfully |
| PROCESSING | FAILED | OCR failure | Unreadable file, corrupt image, timeout |
| PROCESSED | INTERPRETED | NLP extraction done | Entities extracted from OCR text |
| INTERPRETED | VERIFIED | Human review complete | Reviewer confirms extractions |
| VERIFIED | ARCHIVED | Retention policy | Configurable time after verification |
| FAILED | PROCESSING | Retry | Manual retry or automatic retry (max 3) |

---

### ReviewTask Lifecycle

```
     ┌─────────┐
     │ PENDING │
     └────┬────┘
          │
     ┌────▼──────┐
     │ ASSIGNED  │
     └────┬──────┘
          │
     ┌────▼───────────┐
     │ IN_PROGRESS    │
     └────┬───────┬───┘
          │       │
     ┌────▼───┐ ┌─▼────────┐
     │APPROVED│ │ REJECTED │
     └────────┘ └──────────┘

     ┌──────────┐
     │ EXPIRED  │◄── SLA deadline passed while PENDING or ASSIGNED
     └──────────┘
```

#### ReviewTask State Transition Rules

| From | To | Trigger | Conditions |
|------|----|---------|------------|
| — | PENDING | Task created | Order needs human review |
| PENDING | ASSIGNED | Reviewer claims/assigned | Reviewer available |
| ASSIGNED | IN_PROGRESS | Reviewer starts work | Reviewer opens task in UI |
| IN_PROGRESS | APPROVED | Reviewer approves | All fields confirmed/corrected |
| IN_PROGRESS | REJECTED | Reviewer rejects | Order is invalid/duplicate |
| PENDING/ASSIGNED | EXPIRED | SLA deadline passed | No reviewer acted in time |
| EXPIRED | ASSIGNED | Re-assignment | Task escalated and re-assigned |

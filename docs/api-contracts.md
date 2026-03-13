# API Contracts

All APIs use JSON over HTTPS. Authentication is via Bearer JWT tokens unless otherwise noted.
All timestamps are ISO 8601 in UTC. All IDs are UUIDv4.

Base URL: `https://<host>:3000/api/v1`

---

## Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <jwt>` |
| `Content-Type` | Yes (POST/PUT/PATCH) | `application/json` (unless file upload) |
| `X-Request-ID` | No | Client-generated trace ID; echoed in response |
| `X-Facility-ID` | Conditional | Required when user has multi-facility access |

## Common Response Envelope

```json
{
  "data": { ... },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-13T14:30:00.000Z"
  }
}
```

## Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      {
        "field": "patient.dob",
        "message": "Date of birth is required",
        "code": "REQUIRED"
      }
    ]
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-13T14:30:00.000Z"
  }
}
```

## Pagination

List endpoints support cursor-based pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 25 | Items per page (max 100) |
| `cursor` | string | — | Opaque cursor from previous response |
| `sort` | string | `created_at:desc` | Sort field and direction |

Response includes:

```json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "total_count": 1482
  }
}
```

---

## 1. Order Management API

### 1.1 Create Order

```
POST /orders
```

Creates a new radiology order from structured data.

**Request Body:**

```json
{
  "external_id": "EMR-ORD-2026-4521",
  "patient": {
    "mrn": "MRN-001234",
    "first_name": "Jane",
    "last_name": "Doe",
    "dob": "1985-06-15",
    "sex": "female",
    "phone": "555-0123",
    "address": {
      "line1": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "zip": "62704"
    }
  },
  "ordering_provider": {
    "npi": "1234567890",
    "first_name": "John",
    "last_name": "Smith"
  },
  "procedure": {
    "cpt_code": "70553",
    "description": "MRI Brain with and without contrast"
  },
  "clinical_indication": "Chronic headaches, rule out mass",
  "icd_codes": ["R51.9", "G43.909"],
  "priority": "routine",
  "insurance": {
    "payer_name": "Blue Cross Blue Shield",
    "payer_id": "BCBS-IL",
    "member_id": "XYZ123456",
    "group_number": "GRP-789"
  },
  "notes": "Patient is claustrophobic, may need sedation",
  "facility_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response: `201 Created`**

```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "external_id": "EMR-ORD-2026-4521",
    "status": "received",
    "patient_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
    "facility_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "ordering_provider_id": "9f8e7d6c-5b4a-3210-fedc-ba0987654321",
    "procedure_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "priority": "routine",
    "confidence_score": null,
    "created_at": "2026-03-13T14:30:00.000Z",
    "updated_at": "2026-03-13T14:30:00.000Z"
  }
}
```

---

### 1.2 Get Order

```
GET /orders/:id
```

**Response: `200 OK`**

```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "external_id": "EMR-ORD-2026-4521",
    "status": "normalized",
    "patient": {
      "id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
      "mrn": "MRN-001234",
      "first_name": "Jane",
      "last_name": "Doe",
      "dob": "1985-06-15",
      "sex": "female"
    },
    "facility": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Springfield Imaging Center"
    },
    "ordering_provider": {
      "id": "9f8e7d6c-5b4a-3210-fedc-ba0987654321",
      "npi": "1234567890",
      "first_name": "John",
      "last_name": "Smith"
    },
    "procedure": {
      "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
      "cpt_code": "70553",
      "description": "MRI Brain with and without contrast",
      "modality": "mri",
      "body_part": "brain"
    },
    "insurance": {
      "id": "d4e5f6a7-b8c9-0123-4567-890abcdef012",
      "payer_name": "Blue Cross Blue Shield",
      "member_id": "XYZ123456",
      "verified": true
    },
    "clinical_indication": "Chronic headaches, rule out mass",
    "icd_codes": ["R51.9", "G43.909"],
    "priority": "routine",
    "confidence_score": 0.92,
    "notes": "Patient is claustrophobic, may need sedation",
    "source_type": "api",
    "documents": [
      {
        "id": "e5f6a7b8-c9d0-1234-5678-90abcdef0123",
        "type": "referral",
        "status": "verified",
        "original_filename": "referral_doe_jane.pdf"
      }
    ],
    "review_tasks": [],
    "audit_trail": [
      {
        "timestamp": "2026-03-13T14:30:00.000Z",
        "action": "order.created",
        "actor": "api-key:emr-integration"
      },
      {
        "timestamp": "2026-03-13T14:30:05.000Z",
        "action": "order.status_changed",
        "details": { "from": "received", "to": "interpreted" }
      }
    ],
    "created_at": "2026-03-13T14:30:00.000Z",
    "updated_at": "2026-03-13T14:32:00.000Z"
  }
}
```

---

### 1.3 List Orders

```
GET /orders
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (comma-separated for multiple) |
| `facility_id` | UUID | Filter by facility |
| `patient_id` | UUID | Filter by patient |
| `priority` | string | Filter by priority |
| `source_type` | string | Filter by source type |
| `created_after` | ISO 8601 | Created after timestamp |
| `created_before` | ISO 8601 | Created before timestamp |
| `search` | string | Free-text search (patient name, MRN, external ID) |
| `limit` | integer | Page size (default 25, max 100) |
| `cursor` | string | Pagination cursor |

**Response: `200 OK`**

```json
{
  "data": [
    { "id": "...", "status": "...", "patient": { "...": "..." }, "...": "..." }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "total_count": 342
  }
}
```

---

### 1.4 Update Order

```
PATCH /orders/:id
```

Partial update of order fields. Cannot change `status` directly (use state transition endpoints).

**Request Body:**

```json
{
  "clinical_indication": "Updated indication text",
  "icd_codes": ["R51.9", "G43.909", "R42"],
  "priority": "urgent",
  "notes": "Updated notes"
}
```

**Response: `200 OK`** — Updated order object.

---

### 1.5 Transition Order Status

```
POST /orders/:id/transitions
```

**Request Body:**

```json
{
  "to_status": "validated",
  "reason": "All fields confirmed by reviewer"
}
```

**Response: `200 OK`**

```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "validated",
    "previous_status": "pending_review",
    "transitioned_at": "2026-03-13T15:00:00.000Z",
    "transitioned_by": "user:reviewer-001"
  }
}
```

**Error: `422 Unprocessable Entity`** — Invalid transition.

---

### 1.6 Cancel Order

```
POST /orders/:id/cancel
```

**Request Body:**

```json
{
  "reason": "Patient requested cancellation"
}
```

**Response: `200 OK`** — Order with status `cancelled`.

---

## 2. Document Ingestion API

### 2.1 Upload Document

```
POST /documents
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The document file (PDF, TIFF, PNG, JPEG) |
| `type` | string | Yes | Document type enum |
| `order_id` | UUID | No | Link to existing order |
| `facility_id` | UUID | Yes | Facility the document belongs to |
| `metadata` | JSON string | No | Additional metadata |

**Response: `201 Created`**

```json
{
  "data": {
    "id": "e5f6a7b8-c9d0-1234-5678-90abcdef0123",
    "type": "fax",
    "original_filename": "incoming_fax_20260313.pdf",
    "mime_type": "application/pdf",
    "file_size_bytes": 245760,
    "page_count": 3,
    "status": "ingested",
    "order_id": null,
    "storage_key": "documents/2026/03/13/e5f6a7b8-c9d0-1234-5678-90abcdef0123.pdf",
    "created_at": "2026-03-13T14:30:00.000Z"
  }
}
```

---

### 2.2 Get Document

```
GET /documents/:id
```

**Response: `200 OK`** — Full document object including `ocr_text` and `nlp_extractions`.

---

### 2.3 Download Document File

```
GET /documents/:id/file
```

**Response: `200 OK`** — Binary file stream with appropriate `Content-Type` and `Content-Disposition` headers.

---

### 2.4 List Documents

```
GET /documents
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `order_id` | UUID | Filter by order |
| `status` | string | Filter by status |
| `type` | string | Filter by document type |
| `facility_id` | UUID | Filter by facility |
| `limit` | integer | Page size |
| `cursor` | string | Pagination cursor |

---

### 2.5 Re-process Document

```
POST /documents/:id/reprocess
```

Triggers OCR and NLP extraction again (e.g., after improving processing pipeline).

**Response: `202 Accepted`**

```json
{
  "data": {
    "id": "e5f6a7b8-c9d0-1234-5678-90abcdef0123",
    "status": "processing",
    "job_id": "job-abc-123"
  }
}
```

---

### 2.6 Link Document to Order

```
POST /documents/:id/link
```

**Request Body:**

```json
{
  "order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Response: `200 OK`** — Updated document with `order_id` set.

---

## 3. Human Review Workflow API

### 3.1 List Review Tasks

```
GET /review-tasks
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (comma-separated) |
| `assigned_to` | UUID | Filter by assignee |
| `task_type` | string | Filter by task type |
| `priority` | string | Filter by priority |
| `facility_id` | UUID | Filter by facility |
| `sla_status` | string | `on_track`, `at_risk` (< 1hr remaining), `overdue` |
| `limit` | integer | Page size |
| `cursor` | string | Pagination cursor |

**Response: `200 OK`**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
      "order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "document_id": "e5f6a7b8-c9d0-1234-5678-90abcdef0123",
      "status": "pending",
      "task_type": "field_verification",
      "priority": "high",
      "fields_to_review": {
        "procedure": {
          "current_value": null,
          "suggested_value": "70553",
          "suggested_description": "MRI Brain w/ and w/o contrast",
          "confidence": 0.72,
          "source": "nlp"
        },
        "patient.dob": {
          "current_value": null,
          "suggested_value": "1985-06-15",
          "confidence": 0.65,
          "source": "ocr"
        }
      },
      "sla_deadline": "2026-03-13T18:30:00.000Z",
      "created_at": "2026-03-13T14:30:00.000Z"
    }
  ],
  "pagination": { "has_more": false, "total_count": 1 }
}
```

---

### 3.2 Get Review Task

```
GET /review-tasks/:id
```

Returns the full task with embedded order, document, and patient details.

---

### 3.3 Claim Review Task

```
POST /review-tasks/:id/claim
```

Assigns the task to the calling user. Transitions status from `pending` to `assigned`.

**Response: `200 OK`**

```json
{
  "data": {
    "id": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
    "status": "assigned",
    "assigned_to": "user-uuid-here"
  }
}
```

---

### 3.4 Start Review Task

```
POST /review-tasks/:id/start
```

Transitions from `assigned` to `in_progress`. Records `started_at`.

---

### 3.5 Complete Review Task

```
POST /review-tasks/:id/complete
```

**Request Body:**

```json
{
  "action": "approved",
  "resolution": {
    "procedure": {
      "confirmed_value": "70553",
      "changed": false
    },
    "patient.dob": {
      "confirmed_value": "1985-07-15",
      "changed": true,
      "original_suggestion": "1985-06-15"
    }
  },
  "notes": "DOB corrected based on insurance card scan"
}
```

**Response: `200 OK`** — Completed task. Order status transitions to `validated`.

---

### 3.6 Reject Review Task

```
POST /review-tasks/:id/reject
```

**Request Body:**

```json
{
  "reason": "Duplicate order — same patient/procedure already scheduled",
  "duplicate_order_id": "other-order-uuid"
}
```

---

### 3.7 Review Queue Statistics

```
GET /review-tasks/stats
```

**Response: `200 OK`**

```json
{
  "data": {
    "total_pending": 23,
    "total_assigned": 5,
    "total_in_progress": 3,
    "overdue": 2,
    "at_risk": 4,
    "average_completion_minutes": 8.5,
    "by_task_type": {
      "field_verification": 18,
      "procedure_mapping": 7,
      "insurance_verification": 3,
      "duplicate_check": 2
    },
    "by_priority": {
      "critical": 1,
      "high": 8,
      "normal": 17,
      "low": 5
    }
  }
}
```

---

## 4. Webhook Endpoints for EMR Notifications

### 4.1 Register Webhook

```
POST /webhooks
```

**Request Body:**

```json
{
  "url": "https://emr.hospital.org/api/radiology/notifications",
  "events": [
    "order.status_changed",
    "order.scheduled",
    "order.completed",
    "order.cancelled"
  ],
  "facility_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "secret": "whsec_a1b2c3d4e5f6",
  "active": true
}
```

**Response: `201 Created`**

```json
{
  "data": {
    "id": "wh-001",
    "url": "https://emr.hospital.org/api/radiology/notifications",
    "events": ["order.status_changed", "order.scheduled", "order.completed", "order.cancelled"],
    "facility_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "active": true,
    "created_at": "2026-03-13T14:30:00.000Z"
  }
}
```

---

### 4.2 Webhook Payload Format

All webhook deliveries use `POST` with the following structure:

**Headers:**

```
Content-Type: application/json
X-Webhook-ID: wh-001
X-Webhook-Event: order.status_changed
X-Webhook-Delivery-ID: del-550e8400
X-Webhook-Signature: sha256=<HMAC-SHA256 of body using webhook secret>
X-Webhook-Timestamp: 1710340200
```

**Body:**

```json
{
  "event": "order.status_changed",
  "delivery_id": "del-550e8400",
  "timestamp": "2026-03-13T15:00:00.000Z",
  "data": {
    "order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "external_id": "EMR-ORD-2026-4521",
    "previous_status": "pending_review",
    "new_status": "validated",
    "facility_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

Webhooks are retried with exponential backoff (1s, 10s, 60s, 300s, 3600s) on non-2xx responses. After 5 failures, the webhook is disabled and an alert is generated.

---

### 4.3 List Webhooks

```
GET /webhooks
```

### 4.4 Update Webhook

```
PATCH /webhooks/:id
```

### 4.5 Delete Webhook

```
DELETE /webhooks/:id
```

### 4.6 List Webhook Deliveries

```
GET /webhooks/:id/deliveries
```

Returns delivery history with status codes and response times.

---

## 5. HL7v2 Message Handling

### 5.1 Receive HL7v2 Message

```
POST /hl7v2/messages
Content-Type: application/hl7-v2+er7
```

Accepts raw HL7v2 messages (pipe-delimited ER7 format). Supports:

- **ORM^O01** — New order
- **ORM^O01 (cancel)** — Order cancellation
- **ADT^A04** — Patient registration
- **ADT^A08** — Patient update
- **SIU^S12** — Schedule notification

**Request Body (raw HL7v2):**

```
MSH|^~\&|EMR|HOSPITAL|RIP|IMAGING|20260313143000||ORM^O01|MSG00001|P|2.5.1
PID|1||MRN001234^^^HOSP^MR||DOE^JANE||19850615|F|||123 MAIN ST^^SPRINGFIELD^IL^62704
PV1|1|O|^^^CLINIC||||1234567890^SMITH^JOHN
ORC|NW|ORD4521|||||||20260313143000|||1234567890^SMITH^JOHN
OBR|1|ORD4521||70553^MRI BRAIN W AND WO CONTRAST^CPT|||20260313|||||||R51.9^CHRONIC HEADACHES^ICD10|||||||||||^^^20260315100000
IN1|1|BCBS-IL|BCBS||||||GRP-789||||||DOE^JANE|SELF|19850615||||||||||||XYZ123456
```

**Response: `200 OK`** (HL7v2 ACK)

```
MSH|^~\&|RIP|IMAGING|EMR|HOSPITAL|20260313143001||ACK^O01|ACK00001|P|2.5.1
MSA|AA|MSG00001|Message accepted
```

**Response: `200 OK`** (NAK on error)

```
MSH|^~\&|RIP|IMAGING|EMR|HOSPITAL|20260313143001||ACK^O01|ACK00001|P|2.5.1
MSA|AE|MSG00001|Missing required PID segment
ERR|||100^Segment sequence error^HL70357|E|||Missing PID segment
```

---

### 5.2 Send HL7v2 Message (Outbound)

The integration service generates outbound HL7v2 messages when orders reach `scheduled` status. These are sent via MLLP (Minimal Lower Layer Protocol) to configured endpoints, or via the REST wrapper:

```
POST /hl7v2/send
```

**Request Body:**

```json
{
  "destination_id": "ris-endpoint-001",
  "order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "message_type": "ORM_O01"
}
```

**Response: `200 OK`**

```json
{
  "data": {
    "message_id": "MSG-OUT-001",
    "order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "destination": "ris-endpoint-001",
    "status": "acknowledged",
    "ack_code": "AA",
    "sent_at": "2026-03-13T15:00:00.000Z"
  }
}
```

---

### 5.3 HL7v2 Connection Management

```
GET /hl7v2/connections
POST /hl7v2/connections
PATCH /hl7v2/connections/:id
DELETE /hl7v2/connections/:id
```

**Connection Object:**

```json
{
  "id": "ris-endpoint-001",
  "name": "Springfield RIS",
  "protocol": "mllp",
  "host": "ris.springfield.local",
  "port": 2575,
  "direction": "outbound",
  "message_types": ["ORM_O01", "ADT_A04"],
  "facility_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "active": true,
  "last_message_at": "2026-03-13T14:55:00.000Z",
  "status": "connected"
}
```

---

## 6. FHIR R4 Resource Mappings

The platform exposes a FHIR R4-compliant endpoint for systems that prefer FHIR over REST/HL7v2.

Base URL: `https://<host>:3000/fhir/r4`

### 6.1 Supported Resources

| FHIR Resource | Platform Entity | Operations |
|---------------|----------------|------------|
| ServiceRequest | Order | Read, Search, Create |
| Patient | Patient | Read, Search, Create, Update |
| Practitioner | Provider | Read, Search |
| Organization | Facility | Read, Search |
| DocumentReference | Document | Read, Search, Create |
| Task | ReviewTask | Read, Search, Update |
| Coverage | InsurancePlan | Read, Search |

---

### 6.2 ServiceRequest (Order)

**Create:**

```
POST /fhir/r4/ServiceRequest
Content-Type: application/fhir+json
```

```json
{
  "resourceType": "ServiceRequest",
  "identifier": [
    {
      "system": "https://emr.hospital.org/orders",
      "value": "EMR-ORD-2026-4521"
    }
  ],
  "status": "active",
  "intent": "order",
  "priority": "routine",
  "code": {
    "coding": [
      {
        "system": "http://www.ama-assn.org/go/cpt",
        "code": "70553",
        "display": "MRI Brain with and without contrast"
      }
    ]
  },
  "subject": {
    "reference": "Patient/c56a4180-65aa-42ec-a945-5fd21dec0538",
    "display": "Jane Doe"
  },
  "requester": {
    "reference": "Practitioner/9f8e7d6c-5b4a-3210-fedc-ba0987654321",
    "display": "Dr. John Smith"
  },
  "reasonCode": [
    {
      "coding": [
        {
          "system": "http://hl7.org/fhir/sid/icd-10-cm",
          "code": "R51.9",
          "display": "Headache, unspecified"
        }
      ]
    }
  ],
  "insurance": [
    {
      "reference": "Coverage/d4e5f6a7-b8c9-0123-4567-890abcdef012"
    }
  ],
  "note": [
    {
      "text": "Patient is claustrophobic, may need sedation"
    }
  ]
}
```

**Search:**

```
GET /fhir/r4/ServiceRequest?status=active&patient=Patient/c56a4180
GET /fhir/r4/ServiceRequest?identifier=EMR-ORD-2026-4521
GET /fhir/r4/ServiceRequest?_lastUpdated=gt2026-03-12
```

---

### 6.3 Patient

**Search:**

```
GET /fhir/r4/Patient?identifier=MRN-001234
GET /fhir/r4/Patient?family=Doe&birthdate=1985-06-15
```

**Response:**

```json
{
  "resourceType": "Patient",
  "id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "identifier": [
    {
      "system": "https://rip.local/mrn",
      "value": "MRN-001234"
    }
  ],
  "name": [
    {
      "family": "Doe",
      "given": ["Jane"]
    }
  ],
  "gender": "female",
  "birthDate": "1985-06-15",
  "telecom": [
    {
      "system": "phone",
      "value": "555-0123"
    }
  ],
  "address": [
    {
      "line": ["123 Main St"],
      "city": "Springfield",
      "state": "IL",
      "postalCode": "62704"
    }
  ]
}
```

---

### 6.4 DocumentReference

**Create (upload via FHIR):**

```
POST /fhir/r4/DocumentReference
```

```json
{
  "resourceType": "DocumentReference",
  "status": "current",
  "type": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "57133-1",
        "display": "Referral note"
      }
    ]
  },
  "subject": {
    "reference": "Patient/c56a4180-65aa-42ec-a945-5fd21dec0538"
  },
  "content": [
    {
      "attachment": {
        "contentType": "application/pdf",
        "url": "Binary/doc-binary-001",
        "title": "referral_doe_jane.pdf",
        "size": 245760
      }
    }
  ],
  "context": {
    "related": [
      {
        "reference": "ServiceRequest/f47ac10b-58cc-4372-a567-0e02b2c3d479"
      }
    ]
  }
}
```

---

### 6.5 Task (Review Task)

**Search active tasks:**

```
GET /fhir/r4/Task?status=requested,accepted,in-progress&_sort=-priority
```

**Update (complete review):**

```
PUT /fhir/r4/Task/a1b2c3d4-5e6f-7890-abcd-ef1234567890
```

```json
{
  "resourceType": "Task",
  "id": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
  "status": "completed",
  "businessStatus": {
    "coding": [
      {
        "system": "https://rip.local/task-status",
        "code": "approved"
      }
    ]
  },
  "focus": {
    "reference": "ServiceRequest/f47ac10b-58cc-4372-a567-0e02b2c3d479"
  },
  "output": [
    {
      "type": {
        "text": "resolution"
      },
      "valueString": "{\"procedure\":{\"confirmed_value\":\"70553\",\"changed\":false}}"
    }
  ]
}
```

---

### 6.6 FHIR Status Mapping

| Platform Status | FHIR ServiceRequest Status | FHIR Task Status |
|----------------|---------------------------|------------------|
| received | draft | — |
| interpreted | draft | — |
| normalized | active | — |
| pending_review | active | requested |
| validated | active | completed |
| scheduled | active | — |
| completed | completed | — |
| cancelled | revoked | cancelled |
| error | entered-in-error | failed |

---

### 6.7 FHIR Capability Statement

```
GET /fhir/r4/metadata
```

Returns a `CapabilityStatement` resource describing supported resources, search parameters, and operations.

---

## Health & Monitoring Endpoints

### Health Check (all services)

```
GET /health
```

**Response: `200 OK`**

```json
{
  "status": "healthy",
  "service": "order-service",
  "version": "1.0.0",
  "uptime_seconds": 86400,
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "minio": "healthy"
  }
}
```

### Readiness (Kubernetes/Docker)

```
GET /ready
```

Returns `200` when the service is ready to accept traffic, `503` otherwise.

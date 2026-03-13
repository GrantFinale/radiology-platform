-- ============================================================
-- Radiology Interoperability Platform - Initial Schema
-- Migration: 001_initial_schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Custom ENUM types
-- ============================================================

CREATE TYPE order_status AS ENUM (
    'RECEIVED',
    'DOCUMENT_PROCESSING',
    'INTERPRETED',
    'NORMALIZED',
    'VALIDATED',
    'REVIEW_REQUIRED',
    'SCHEDULED',
    'COMPLETED',
    'REJECTED',
    'ERROR'
);

CREATE TYPE order_source AS ENUM (
    'FAX',
    'SCANNED_PDF',
    'HANDWRITTEN',
    'EMR',
    'HL7',
    'FHIR',
    'EMAIL',
    'MANUAL'
);

CREATE TYPE document_type AS ENUM (
    'FAX',
    'PDF',
    'IMAGE',
    'HL7_MESSAGE',
    'FHIR_BUNDLE',
    'EMAIL'
);

CREATE TYPE review_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'APPROVED',
    'REJECTED',
    'ESCALATED'
);

CREATE TYPE order_priority AS ENUM (
    'STAT',
    'URGENT',
    'ASAP',
    'ROUTINE'
);

CREATE TYPE gender_type AS ENUM (
    'M',
    'F',
    'O',
    'U'
);

CREATE TYPE laterality_type AS ENUM (
    'LEFT',
    'RIGHT',
    'BILATERAL',
    'N/A'
);

CREATE TYPE insurance_plan_type AS ENUM (
    'HMO',
    'PPO',
    'EPO',
    'POS',
    'MEDICARE',
    'MEDICAID',
    'TRICARE',
    'WORKERS_COMP',
    'SELF_PAY',
    'OTHER'
);

CREATE TYPE audit_action AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'STATUS_CHANGE',
    'ASSIGN',
    'VIEW',
    'EXPORT',
    'IMPORT'
);

CREATE TYPE audit_entity_type AS ENUM (
    'ORDER',
    'PATIENT',
    'DOCUMENT',
    'REVIEW_TASK',
    'PROVIDER',
    'FACILITY'
);

-- ============================================================
-- Function: auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Table: facilities
-- ============================================================

CREATE TABLE facilities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(2),
    zip_code        VARCHAR(10),
    phone           VARCHAR(20),
    fax             VARCHAR(20),
    email           VARCHAR(255),
    npi             VARCHAR(10),
    tax_id          VARCHAR(20),
    emr_system      VARCHAR(100),
    emr_version     VARCHAR(50),
    accreditation_number VARCHAR(50),
    scheduling_endpoint  VARCHAR(500),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_facilities_name ON facilities (name);
CREATE INDEX idx_facilities_state ON facilities (state);
CREATE INDEX idx_facilities_npi ON facilities (npi) WHERE npi IS NOT NULL;
CREATE INDEX idx_facilities_emr_system ON facilities (emr_system) WHERE emr_system IS NOT NULL;

-- ============================================================
-- Table: patients
-- ============================================================

CREATE TABLE patients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mrn             VARCHAR(20) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    middle_name     VARCHAR(100),
    date_of_birth   DATE NOT NULL,
    gender          gender_type NOT NULL DEFAULT 'U',
    ssn_hash        VARCHAR(64),
    phone           VARCHAR(20),
    phone_secondary VARCHAR(20),
    email           VARCHAR(255),
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(2),
    zip_code        VARCHAR(10),
    preferred_language VARCHAR(10) DEFAULT 'en',
    emergency_contact_name  VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE UNIQUE INDEX idx_patients_mrn ON patients (mrn);
CREATE INDEX idx_patients_name ON patients (last_name, first_name);
CREATE INDEX idx_patients_dob ON patients (date_of_birth);
CREATE INDEX idx_patients_phone ON patients (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_patients_email ON patients (email) WHERE email IS NOT NULL;

-- ============================================================
-- Table: providers
-- ============================================================

CREATE TABLE providers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    npi             VARCHAR(10) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    middle_name     VARCHAR(100),
    suffix          VARCHAR(20),
    specialty       VARCHAR(100) NOT NULL,
    facility_id     UUID REFERENCES facilities(id) ON DELETE SET NULL,
    phone           VARCHAR(20),
    fax             VARCHAR(20),
    email           VARCHAR(255),
    emr_id          VARCHAR(100),
    dea_number      VARCHAR(20),
    state_license_number VARCHAR(50),
    taxonomy_code   VARCHAR(20),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER providers_updated_at
    BEFORE UPDATE ON providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE UNIQUE INDEX idx_providers_npi ON providers (npi);
CREATE INDEX idx_providers_name ON providers (last_name, first_name);
CREATE INDEX idx_providers_facility ON providers (facility_id);
CREATE INDEX idx_providers_specialty ON providers (specialty);
CREATE INDEX idx_providers_emr_id ON providers (emr_id) WHERE emr_id IS NOT NULL;

-- ============================================================
-- Table: insurance_plans
-- ============================================================

CREATE TABLE insurance_plans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    payer_name          VARCHAR(255) NOT NULL,
    payer_id            VARCHAR(50),
    plan_name           VARCHAR(255),
    plan_type           insurance_plan_type NOT NULL DEFAULT 'OTHER',
    member_id           VARCHAR(100) NOT NULL,
    group_number        VARCHAR(100),
    subscriber_name     VARCHAR(200),
    subscriber_relationship VARCHAR(20) DEFAULT 'SELF',
    effective_date      DATE,
    termination_date    DATE,
    copay_amount        DECIMAL(10, 2),
    authorization_required BOOLEAN DEFAULT FALSE,
    authorization_number   VARCHAR(100),
    authorization_expiration DATE,
    is_primary          BOOLEAN NOT NULL DEFAULT TRUE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER insurance_plans_updated_at
    BEFORE UPDATE ON insurance_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_insurance_plans_patient ON insurance_plans (patient_id);
CREATE INDEX idx_insurance_plans_member ON insurance_plans (member_id);
CREATE INDEX idx_insurance_plans_payer ON insurance_plans (payer_name);
CREATE INDEX idx_insurance_plans_active ON insurance_plans (patient_id, is_primary) WHERE active = TRUE;

-- ============================================================
-- Table: orders
-- ============================================================

CREATE TABLE orders (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id             VARCHAR(100),
    accession_number        VARCHAR(50),
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    ordering_provider_id    UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    referring_provider_id   UUID REFERENCES providers(id) ON DELETE SET NULL,
    facility_id             UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    insurance_plan_id       UUID REFERENCES insurance_plans(id) ON DELETE SET NULL,
    source                  order_source NOT NULL,
    status                  order_status NOT NULL DEFAULT 'RECEIVED',
    priority                order_priority NOT NULL DEFAULT 'ROUTINE',
    cpt_code                VARCHAR(10) NOT NULL,
    cpt_description         VARCHAR(500),
    icd10_codes             TEXT[] NOT NULL DEFAULT '{}',
    icd10_descriptions      TEXT[],
    modality                VARCHAR(20) NOT NULL,
    body_part               VARCHAR(50) NOT NULL,
    laterality              laterality_type DEFAULT 'N/A',
    contrast                BOOLEAN DEFAULT FALSE,
    clinical_indication     TEXT NOT NULL,
    clinical_history        TEXT,
    special_instructions    TEXT,
    patient_prep            TEXT,
    reason_for_exam         TEXT,
    transport_mode          VARCHAR(20),
    isolation_precautions   VARCHAR(100),
    pregnancy_status        VARCHAR(10),
    weight                  DECIMAL(6, 2),
    weight_unit             VARCHAR(2) DEFAULT 'KG',
    creatinine_level        DECIMAL(5, 2),
    gfr                     INTEGER,
    diabetic_status         BOOLEAN,
    previous_exams          TEXT,
    scheduled_datetime      TIMESTAMPTZ,
    scheduled_location      VARCHAR(255),
    scheduled_duration_minutes INTEGER,
    confidence_score        DECIMAL(5, 4),
    requires_review         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for orders
CREATE INDEX idx_orders_external_id ON orders (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_orders_accession ON orders (accession_number) WHERE accession_number IS NOT NULL;
CREATE INDEX idx_orders_patient ON orders (patient_id);
CREATE INDEX idx_orders_provider ON orders (ordering_provider_id);
CREATE INDEX idx_orders_facility ON orders (facility_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_source ON orders (source);
CREATE INDEX idx_orders_priority ON orders (priority);
CREATE INDEX idx_orders_modality ON orders (modality);
CREATE INDEX idx_orders_cpt_code ON orders (cpt_code);
CREATE INDEX idx_orders_requires_review ON orders (requires_review) WHERE requires_review = TRUE;
CREATE INDEX idx_orders_scheduled ON orders (scheduled_datetime) WHERE scheduled_datetime IS NOT NULL;
CREATE INDEX idx_orders_created_at ON orders (created_at);
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_facility_status ON orders (facility_id, status);
CREATE INDEX idx_orders_patient_created ON orders (patient_id, created_at DESC);

-- Constraint: confidence score between 0 and 1
ALTER TABLE orders ADD CONSTRAINT chk_confidence_score
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1));

-- Constraint: weight must be positive
ALTER TABLE orders ADD CONSTRAINT chk_weight_positive
    CHECK (weight IS NULL OR weight > 0);

-- ============================================================
-- Table: documents
-- ============================================================

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type            document_type NOT NULL,
    source_path     VARCHAR(1000),
    storage_key     VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255),
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT,
    page_count      INTEGER,
    ocr_text        TEXT,
    ocr_confidence  DECIMAL(5, 4),
    ocr_engine      VARCHAR(50),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_order ON documents (order_id);
CREATE INDEX idx_documents_type ON documents (type);
CREATE INDEX idx_documents_storage_key ON documents (storage_key);
CREATE INDEX idx_documents_created_at ON documents (created_at);

-- Constraint: OCR confidence between 0 and 1
ALTER TABLE documents ADD CONSTRAINT chk_ocr_confidence
    CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1));

-- GIN index for JSONB metadata queries
CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata);

-- Full-text search index on OCR text
CREATE INDEX idx_documents_ocr_text ON documents USING GIN (to_tsvector('english', COALESCE(ocr_text, '')));

-- ============================================================
-- Table: review_tasks
-- ============================================================

CREATE TABLE review_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
    status          review_status NOT NULL DEFAULT 'PENDING',
    assigned_to     VARCHAR(255),
    assigned_at     TIMESTAMPTZ,
    reason          TEXT,
    notes           TEXT,
    resolution      TEXT,
    fields_to_review TEXT[],
    original_values  JSONB,
    corrected_values JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TRIGGER review_tasks_updated_at
    BEFORE UPDATE ON review_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_review_tasks_order ON review_tasks (order_id);
CREATE INDEX idx_review_tasks_document ON review_tasks (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_review_tasks_status ON review_tasks (status);
CREATE INDEX idx_review_tasks_assigned ON review_tasks (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_review_tasks_pending ON review_tasks (status, created_at) WHERE status = 'PENDING';

-- ============================================================
-- Table: audit_log
-- ============================================================

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     audit_entity_type NOT NULL,
    entity_id       UUID NOT NULL,
    action          audit_action NOT NULL,
    actor           VARCHAR(255) NOT NULL,
    actor_type      VARCHAR(20) DEFAULT 'USER',
    ip_address      INET,
    user_agent      TEXT,
    changes         JSONB,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is append-only, optimize for reads
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log (actor);
CREATE INDEX idx_audit_log_action ON audit_log (action);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);
CREATE INDEX idx_audit_log_entity_time ON audit_log (entity_type, entity_id, created_at DESC);

-- ============================================================
-- Table: order_status_history
-- ============================================================

CREATE TABLE order_status_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status     order_status,
    to_status       order_status NOT NULL,
    reason          TEXT,
    actor           VARCHAR(255) NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history (order_id);
CREATE INDEX idx_status_history_order_time ON order_status_history (order_id, created_at DESC);
CREATE INDEX idx_status_history_to_status ON order_status_history (to_status);
CREATE INDEX idx_status_history_created_at ON order_status_history (created_at);

-- ============================================================
-- Trigger: auto-record order status changes
-- ============================================================

CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, actor)
        VALUES (NEW.id, OLD.status, NEW.status, COALESCE(current_setting('app.current_user', TRUE), 'SYSTEM'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_status_change
    AFTER UPDATE ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION record_order_status_change();

-- ============================================================
-- Trigger: auto-set completed_at on review tasks
-- ============================================================

CREATE OR REPLACE FUNCTION set_review_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('APPROVED', 'REJECTED') AND OLD.status NOT IN ('APPROVED', 'REJECTED') THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_tasks_completed_at
    BEFORE UPDATE ON review_tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_review_completed_at();

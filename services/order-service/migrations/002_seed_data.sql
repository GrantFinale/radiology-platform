-- ============================================================
-- Radiology Interoperability Platform - Seed Data
-- Migration: 002_seed_data
-- ============================================================

-- ============================================================
-- Facilities
-- ============================================================

INSERT INTO facilities (id, name, address_line1, city, state, zip_code, phone, fax, email, npi, emr_system, emr_version, active) VALUES
(
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Metro Regional Medical Center',
    '500 Main Street',
    'Springfield',
    'IL',
    '62701',
    '(217) 555-0100',
    '(217) 555-0101',
    'radiology@metromed.example.com',
    '1234567893',
    'Epic',
    '2024.1',
    TRUE
),
(
    'a1b2c3d4-0001-4000-8000-000000000002',
    'Westside Imaging Center',
    '1200 Oak Avenue, Suite 300',
    'Springfield',
    'IL',
    '62704',
    '(217) 555-0200',
    '(217) 555-0201',
    'info@westsideimaging.example.com',
    '1234567901',
    'Cerner',
    '2023.4',
    TRUE
),
(
    'a1b2c3d4-0001-4000-8000-000000000003',
    'University Health System - Radiology',
    '800 University Drive',
    'Chicago',
    'IL',
    '60612',
    '(312) 555-0300',
    '(312) 555-0301',
    'rad-orders@uhs.example.com',
    '1234567919',
    'Epic',
    '2024.2',
    TRUE
),
(
    'a1b2c3d4-0001-4000-8000-000000000004',
    'Lakeside Community Hospital',
    '2500 Lakeshore Boulevard',
    'Peoria',
    'IL',
    '61602',
    '(309) 555-0400',
    '(309) 555-0401',
    'imaging@lakesidech.example.com',
    '1234567927',
    'Meditech',
    '6.1',
    TRUE
),
(
    'a1b2c3d4-0001-4000-8000-000000000005',
    'Prairie Urgent Care & Diagnostics',
    '150 Prairie Lane',
    'Champaign',
    'IL',
    '61820',
    '(217) 555-0500',
    '(217) 555-0501',
    'orders@prairieuc.example.com',
    '1234567935',
    NULL,
    NULL,
    TRUE
);

-- ============================================================
-- Providers
-- ============================================================

INSERT INTO providers (id, npi, first_name, last_name, suffix, specialty, facility_id, phone, fax, email, emr_id) VALUES
(
    'b1c2d3e4-0001-4000-8000-000000000001',
    '1122334455',
    'Sarah',
    'Chen',
    'MD',
    'Internal Medicine',
    'a1b2c3d4-0001-4000-8000-000000000001',
    '(217) 555-1001',
    '(217) 555-1002',
    'sarah.chen@metromed.example.com',
    'PROV-001'
),
(
    'b1c2d3e4-0001-4000-8000-000000000002',
    '2233445566',
    'James',
    'Rodriguez',
    'DO',
    'Orthopedic Surgery',
    'a1b2c3d4-0001-4000-8000-000000000001',
    '(217) 555-1003',
    '(217) 555-1004',
    'james.rodriguez@metromed.example.com',
    'PROV-002'
),
(
    'b1c2d3e4-0001-4000-8000-000000000003',
    '3344556677',
    'Emily',
    'Thompson',
    'MD',
    'Neurology',
    'a1b2c3d4-0001-4000-8000-000000000003',
    '(312) 555-2001',
    '(312) 555-2002',
    'emily.thompson@uhs.example.com',
    'PROV-003'
),
(
    'b1c2d3e4-0001-4000-8000-000000000004',
    '4455667788',
    'Michael',
    'Patel',
    'MD',
    'Emergency Medicine',
    'a1b2c3d4-0001-4000-8000-000000000004',
    '(309) 555-3001',
    '(309) 555-3002',
    'michael.patel@lakesidech.example.com',
    NULL
),
(
    'b1c2d3e4-0001-4000-8000-000000000005',
    '5566778899',
    'Lisa',
    'Kim',
    'MD',
    'Family Medicine',
    'a1b2c3d4-0001-4000-8000-000000000005',
    '(217) 555-4001',
    '(217) 555-4002',
    'lisa.kim@prairieuc.example.com',
    NULL
),
(
    'b1c2d3e4-0001-4000-8000-000000000006',
    '6677889900',
    'David',
    'Nakamura',
    'MD',
    'Radiology',
    'a1b2c3d4-0001-4000-8000-000000000001',
    '(217) 555-1010',
    '(217) 555-1011',
    'david.nakamura@metromed.example.com',
    'PROV-006'
),
(
    'b1c2d3e4-0001-4000-8000-000000000007',
    '7788990011',
    'Amanda',
    'Wright',
    'MD',
    'Pulmonology',
    'a1b2c3d4-0001-4000-8000-000000000003',
    '(312) 555-2010',
    '(312) 555-2011',
    'amanda.wright@uhs.example.com',
    'PROV-007'
);

-- ============================================================
-- Patients
-- ============================================================

INSERT INTO patients (id, mrn, first_name, last_name, middle_name, date_of_birth, gender, phone, email, address_line1, city, state, zip_code) VALUES
(
    'c1d2e3f4-0001-4000-8000-000000000001',
    'MRN-100001',
    'John',
    'Smith',
    'Robert',
    '1965-03-15',
    'M',
    '(217) 555-8001',
    'john.smith@example.com',
    '123 Elm Street',
    'Springfield',
    'IL',
    '62701'
),
(
    'c1d2e3f4-0001-4000-8000-000000000002',
    'MRN-100002',
    'Maria',
    'Garcia',
    'Elena',
    '1978-07-22',
    'F',
    '(217) 555-8002',
    'maria.garcia@example.com',
    '456 Maple Avenue',
    'Springfield',
    'IL',
    '62702'
),
(
    'c1d2e3f4-0001-4000-8000-000000000003',
    'MRN-100003',
    'Robert',
    'Johnson',
    NULL,
    '1952-11-08',
    'M',
    '(312) 555-8003',
    NULL,
    '789 Pine Road',
    'Chicago',
    'IL',
    '60614'
),
(
    'c1d2e3f4-0001-4000-8000-000000000004',
    'MRN-100004',
    'Angela',
    'Williams',
    'Marie',
    '1990-01-30',
    'F',
    '(309) 555-8004',
    'angela.w@example.com',
    '321 Cedar Lane',
    'Peoria',
    'IL',
    '61602'
),
(
    'c1d2e3f4-0001-4000-8000-000000000005',
    'MRN-100005',
    'David',
    'Lee',
    'Jun',
    '1985-09-12',
    'M',
    '(217) 555-8005',
    'david.lee@example.com',
    '555 Birch Court',
    'Champaign',
    'IL',
    '61820'
);

-- ============================================================
-- Insurance Plans
-- ============================================================

INSERT INTO insurance_plans (id, patient_id, payer_name, payer_id, plan_name, plan_type, member_id, group_number, subscriber_name, subscriber_relationship, effective_date, is_primary) VALUES
(
    'd1e2f3a4-0001-4000-8000-000000000001',
    'c1d2e3f4-0001-4000-8000-000000000001',
    'Blue Cross Blue Shield of Illinois',
    'BCBS-IL',
    'PPO Gold',
    'PPO',
    'BCBS-987654321',
    'GRP-12345',
    'John R Smith',
    'SELF',
    '2024-01-01',
    TRUE
),
(
    'd1e2f3a4-0001-4000-8000-000000000002',
    'c1d2e3f4-0001-4000-8000-000000000002',
    'Aetna',
    'AETNA-001',
    'HMO Standard',
    'HMO',
    'AET-123456789',
    'GRP-67890',
    'Maria E Garcia',
    'SELF',
    '2024-01-01',
    TRUE
),
(
    'd1e2f3a4-0001-4000-8000-000000000003',
    'c1d2e3f4-0001-4000-8000-000000000003',
    'Medicare',
    'CMS-MEDICARE',
    'Medicare Part B',
    'MEDICARE',
    'MCR-1EG4-TE5-MK72',
    NULL,
    'Robert Johnson',
    'SELF',
    '2017-11-01',
    TRUE
),
(
    'd1e2f3a4-0001-4000-8000-000000000004',
    'c1d2e3f4-0001-4000-8000-000000000004',
    'UnitedHealthcare',
    'UHC-001',
    'Choice Plus PPO',
    'PPO',
    'UHC-555666777',
    'GRP-44444',
    'Angela M Williams',
    'SELF',
    '2024-03-01',
    TRUE
),
(
    'd1e2f3a4-0001-4000-8000-000000000005',
    'c1d2e3f4-0001-4000-8000-000000000005',
    'Cigna',
    'CIGNA-001',
    'Open Access Plus',
    'EPO',
    'CGN-888999000',
    'GRP-55555',
    'David J Lee',
    'SELF',
    '2024-01-01',
    TRUE
);

-- ============================================================
-- Sample Orders
-- ============================================================

INSERT INTO orders (
    id, external_id, patient_id, ordering_provider_id, facility_id,
    insurance_plan_id, source, status, priority,
    cpt_code, cpt_description, icd10_codes, icd10_descriptions,
    modality, body_part, laterality, contrast,
    clinical_indication, clinical_history,
    confidence_score, requires_review
) VALUES
(
    'e1f2a3b4-0001-4000-8000-000000000001',
    'ORD-EXT-20240301-001',
    'c1d2e3f4-0001-4000-8000-000000000001',
    'b1c2d3e4-0001-4000-8000-000000000001',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'd1e2f3a4-0001-4000-8000-000000000001',
    'EMR',
    'VALIDATED',
    'ROUTINE',
    '71046',
    'X-ray chest 2 views',
    ARRAY['R05.9', 'J06.9'],
    ARRAY['Cough, unspecified', 'Acute upper respiratory infection, unspecified'],
    'XRAY',
    'CHEST',
    'N/A',
    FALSE,
    'Persistent cough for 3 weeks, rule out pneumonia',
    'No significant past medical history. Non-smoker.',
    0.9500,
    FALSE
),
(
    'e1f2a3b4-0001-4000-8000-000000000002',
    NULL,
    'c1d2e3f4-0001-4000-8000-000000000002',
    'b1c2d3e4-0001-4000-8000-000000000002',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'd1e2f3a4-0001-4000-8000-000000000002',
    'FAX',
    'REVIEW_REQUIRED',
    'URGENT',
    '73721',
    'MRI lower extremity joint without contrast (knee)',
    ARRAY['M23.51'],
    ARRAY['Chronic instability of knee, right'],
    'MRI',
    'KNEE',
    'RIGHT',
    FALSE,
    'Right knee pain and instability, suspected meniscal tear',
    'Patient reports twisting injury 2 weeks ago during soccer. Positive McMurray test on exam.',
    0.7200,
    TRUE
),
(
    'e1f2a3b4-0001-4000-8000-000000000003',
    'HL7-MSG-20240302-001',
    'c1d2e3f4-0001-4000-8000-000000000003',
    'b1c2d3e4-0001-4000-8000-000000000003',
    'a1b2c3d4-0001-4000-8000-000000000003',
    'd1e2f3a4-0001-4000-8000-000000000003',
    'HL7',
    'SCHEDULED',
    'ROUTINE',
    '70553',
    'MRI brain without contrast, followed by contrast',
    ARRAY['G43.909', 'R51.9'],
    ARRAY['Migraine, unspecified, not intractable', 'Headache, unspecified'],
    'MRI',
    'BRAIN',
    'N/A',
    TRUE,
    'Chronic migraines with new neurological symptoms, rule out intracranial pathology',
    'History of migraines since age 25. Recent onset of visual aura and left-sided numbness.',
    0.9800,
    FALSE
),
(
    'e1f2a3b4-0001-4000-8000-000000000004',
    NULL,
    'c1d2e3f4-0001-4000-8000-000000000004',
    'b1c2d3e4-0001-4000-8000-000000000004',
    'a1b2c3d4-0001-4000-8000-000000000004',
    'd1e2f3a4-0001-4000-8000-000000000004',
    'SCANNED_PDF',
    'DOCUMENT_PROCESSING',
    'STAT',
    '74178',
    'CT abdomen and pelvis without contrast, followed by contrast',
    ARRAY['R10.0', 'R11.2'],
    ARRAY['Acute abdomen', 'Nausea with vomiting, unspecified'],
    'CT',
    'ABDOMEN_PELVIS',
    'N/A',
    TRUE,
    'Acute abdominal pain with nausea and vomiting, rule out appendicitis',
    'Presented to ED with RLQ pain, guarding, and rebound tenderness. WBC 14,500.',
    0.6500,
    TRUE
),
(
    'e1f2a3b4-0001-4000-8000-000000000005',
    'FHIR-SR-20240303-001',
    'c1d2e3f4-0001-4000-8000-000000000005',
    'b1c2d3e4-0001-4000-8000-000000000005',
    'a1b2c3d4-0001-4000-8000-000000000005',
    'd1e2f3a4-0001-4000-8000-000000000005',
    'FHIR',
    'RECEIVED',
    'ROUTINE',
    '76700',
    'US abdomen complete',
    ARRAY['R10.9', 'K80.20'],
    ARRAY['Unspecified abdominal pain', 'Calculus of gallbladder without cholecystitis'],
    'US',
    'ABDOMEN',
    'N/A',
    FALSE,
    'Recurrent RUQ pain, evaluate for gallstones',
    'Intermittent postprandial RUQ pain for 6 months. No fever or jaundice.',
    NULL,
    FALSE
);

-- ============================================================
-- Sample Documents
-- ============================================================

INSERT INTO documents (id, order_id, type, storage_key, file_name, mime_type, file_size_bytes, page_count, ocr_confidence, metadata) VALUES
(
    'f1a2b3c4-0001-4000-8000-000000000001',
    'e1f2a3b4-0001-4000-8000-000000000002',
    'FAX',
    's3://radiology-documents/fax/2024/03/01/fax-order-garcia-knee.tiff',
    'fax-order-garcia-knee.tiff',
    'image/tiff',
    2458624,
    2,
    0.8500,
    '{"source_fax_number": "+12175551234", "received_at": "2024-03-01T14:30:00Z", "sender_name": "Dr. Rodriguez Office"}'
),
(
    'f1a2b3c4-0001-4000-8000-000000000002',
    'e1f2a3b4-0001-4000-8000-000000000004',
    'PDF',
    's3://radiology-documents/scanned/2024/03/02/scan-order-williams-ct.pdf',
    'scan-order-williams-ct.pdf',
    'application/pdf',
    1048576,
    1,
    0.6200,
    '{"scanner_id": "SCANNER-ER-01", "scanned_at": "2024-03-02T08:15:00Z", "scanned_by": "ER-CLERK-004"}'
),
(
    'f1a2b3c4-0001-4000-8000-000000000003',
    'e1f2a3b4-0001-4000-8000-000000000003',
    'HL7_MESSAGE',
    's3://radiology-documents/hl7/2024/03/02/orm-johnson-brain-mri.hl7',
    'orm-johnson-brain-mri.hl7',
    'application/hl7-v2',
    4096,
    NULL,
    NULL,
    '{"message_control_id": "MSG-20240302-001", "sending_application": "UHS-EPIC", "message_type": "ORM^O01"}'
);

-- ============================================================
-- Sample Review Tasks
-- ============================================================

INSERT INTO review_tasks (id, order_id, document_id, status, reason, fields_to_review) VALUES
(
    'a2b3c4d5-0001-4000-8000-000000000001',
    'e1f2a3b4-0001-4000-8000-000000000002',
    'f1a2b3c4-0001-4000-8000-000000000001',
    'PENDING',
    'Low confidence OCR extraction from fax document. CPT code and laterality need verification.',
    ARRAY['cpt_code', 'laterality', 'icd10_codes']
),
(
    'a2b3c4d5-0001-4000-8000-000000000002',
    'e1f2a3b4-0001-4000-8000-000000000004',
    'f1a2b3c4-0001-4000-8000-000000000002',
    'PENDING',
    'STAT order from scanned PDF with low confidence. Clinical indication and ICD-10 codes require manual review.',
    ARRAY['clinical_indication', 'icd10_codes', 'cpt_code', 'patient_prep']
);

-- ============================================================
-- Sample Audit Log Entries
-- ============================================================

INSERT INTO audit_log (entity_type, entity_id, action, actor, actor_type, changes) VALUES
(
    'ORDER',
    'e1f2a3b4-0001-4000-8000-000000000001',
    'CREATE',
    'SYSTEM:EMR-INTEGRATION',
    'SYSTEM',
    '{"source": "Epic EMR via HL7 interface"}'
),
(
    'ORDER',
    'e1f2a3b4-0001-4000-8000-000000000001',
    'STATUS_CHANGE',
    'SYSTEM:ORDER-PROCESSOR',
    'SYSTEM',
    '{"status": {"from": "RECEIVED", "to": "VALIDATED"}}'
),
(
    'ORDER',
    'e1f2a3b4-0001-4000-8000-000000000002',
    'CREATE',
    'SYSTEM:FAX-PROCESSOR',
    'SYSTEM',
    '{"source": "Fax received from (217) 555-1234"}'
),
(
    'DOCUMENT',
    'f1a2b3c4-0001-4000-8000-000000000001',
    'CREATE',
    'SYSTEM:FAX-PROCESSOR',
    'SYSTEM',
    '{"file_name": "fax-order-garcia-knee.tiff", "page_count": 2}'
),
(
    'ORDER',
    'e1f2a3b4-0001-4000-8000-000000000004',
    'CREATE',
    'SYSTEM:DOCUMENT-SCANNER',
    'SYSTEM',
    '{"source": "ER document scanner"}'
);

-- ============================================================
-- Sample Order Status History
-- ============================================================

INSERT INTO order_status_history (order_id, from_status, to_status, actor) VALUES
(
    'e1f2a3b4-0001-4000-8000-000000000001',
    NULL,
    'RECEIVED',
    'SYSTEM:EMR-INTEGRATION'
),
(
    'e1f2a3b4-0001-4000-8000-000000000001',
    'RECEIVED',
    'NORMALIZED',
    'SYSTEM:ORDER-PROCESSOR'
),
(
    'e1f2a3b4-0001-4000-8000-000000000001',
    'NORMALIZED',
    'VALIDATED',
    'SYSTEM:ORDER-PROCESSOR'
),
(
    'e1f2a3b4-0001-4000-8000-000000000002',
    NULL,
    'RECEIVED',
    'SYSTEM:FAX-PROCESSOR'
),
(
    'e1f2a3b4-0001-4000-8000-000000000002',
    'RECEIVED',
    'DOCUMENT_PROCESSING',
    'SYSTEM:OCR-ENGINE'
),
(
    'e1f2a3b4-0001-4000-8000-000000000002',
    'DOCUMENT_PROCESSING',
    'INTERPRETED',
    'SYSTEM:NLP-SERVICE'
),
(
    'e1f2a3b4-0001-4000-8000-000000000002',
    'INTERPRETED',
    'REVIEW_REQUIRED',
    'SYSTEM:VALIDATION-ENGINE'
),
(
    'e1f2a3b4-0001-4000-8000-000000000003',
    NULL,
    'RECEIVED',
    'SYSTEM:HL7-LISTENER'
),
(
    'e1f2a3b4-0001-4000-8000-000000000003',
    'RECEIVED',
    'NORMALIZED',
    'SYSTEM:ORDER-PROCESSOR'
),
(
    'e1f2a3b4-0001-4000-8000-000000000003',
    'NORMALIZED',
    'VALIDATED',
    'SYSTEM:ORDER-PROCESSOR'
),
(
    'e1f2a3b4-0001-4000-8000-000000000003',
    'VALIDATED',
    'SCHEDULED',
    'SYSTEM:SCHEDULER'
);

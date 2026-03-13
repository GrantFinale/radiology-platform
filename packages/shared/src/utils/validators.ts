/**
 * Validates a CPT code format.
 * CPT codes are 5 digits, optionally followed by a modifier (e.g., 73721, 73721-26).
 */
export function validateCPTCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'CPT code is required' };
  }

  const trimmed = code.trim();
  const cptRegex = /^\d{5}(-\d{2})?$/;

  if (!cptRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'CPT code must be 5 digits, optionally followed by a 2-digit modifier (e.g., 73721 or 73721-26)',
    };
  }

  return { valid: true };
}

/**
 * Validates an ICD-10-CM diagnosis code format.
 * ICD-10 codes start with a letter, followed by 2 digits, optionally a dot and 1-4 alphanumeric characters.
 * Examples: M54.5, S72.001A, R10.9
 */
export function validateICD10Code(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'ICD-10 code is required' };
  }

  const trimmed = code.trim().toUpperCase();
  const icd10Regex = /^[A-Z]\d{2}(\.\d{1,4}[A-Z]?)?$/;

  if (!icd10Regex.test(trimmed)) {
    return {
      valid: false,
      error: 'ICD-10 code must start with a letter followed by 2 digits, optionally a decimal and up to 4 alphanumeric characters (e.g., M54.5, S72.001A)',
    };
  }

  return { valid: true };
}

/**
 * Validates a National Provider Identifier (NPI).
 * NPI is a 10-digit number that satisfies the Luhn check digit algorithm.
 */
export function validateNPI(npi: string): { valid: boolean; error?: string } {
  if (!npi || typeof npi !== 'string') {
    return { valid: false, error: 'NPI is required' };
  }

  const trimmed = npi.trim();

  if (!/^\d{10}$/.test(trimmed)) {
    return { valid: false, error: 'NPI must be exactly 10 digits' };
  }

  // Luhn algorithm validation with prefix 80840 for NPI
  const prefixedNpi = '80840' + trimmed;
  let sum = 0;
  let alternate = false;

  for (let i = prefixedNpi.length - 1; i >= 0; i--) {
    const char = prefixedNpi[i];
    if (char === undefined) continue;
    let digit = parseInt(char, 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: 'NPI failed Luhn check digit validation' };
  }

  return { valid: true };
}

/**
 * Validates a Medical Record Number (MRN).
 * MRN format varies by institution but generally is alphanumeric, 4-20 characters.
 */
export function validateMRN(mrn: string): { valid: boolean; error?: string } {
  if (!mrn || typeof mrn !== 'string') {
    return { valid: false, error: 'MRN is required' };
  }

  const trimmed = mrn.trim();

  if (trimmed.length < 4 || trimmed.length > 20) {
    return { valid: false, error: 'MRN must be between 4 and 20 characters' };
  }

  if (!/^[A-Za-z0-9\-]+$/.test(trimmed)) {
    return { valid: false, error: 'MRN must contain only alphanumeric characters and hyphens' };
  }

  return { valid: true };
}

/**
 * Validates basic HL7v2 message structure.
 * Checks for MSH segment header and basic field structure.
 */
export function validateHL7Message(message: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!message || typeof message !== 'string') {
    return { valid: false, errors: ['HL7 message is required'] };
  }

  const trimmed = message.trim();

  // Must start with MSH
  if (!trimmed.startsWith('MSH')) {
    errors.push('HL7 message must start with MSH segment');
  }

  // Check field separator (character at position 3)
  if (trimmed.length < 4) {
    errors.push('HL7 message is too short');
    return { valid: false, errors };
  }

  const fieldSeparator = trimmed[3] ?? '|';
  if (fieldSeparator !== '|') {
    errors.push('Expected pipe (|) as field separator at position 4');
  }

  // Split into segments by carriage return or newline
  const segments = trimmed.split(/\r?\n|\r/).filter((s) => s.length > 0);

  if (segments.length < 1) {
    errors.push('HL7 message must contain at least an MSH segment');
    return { valid: false, errors };
  }

  // Validate MSH segment has minimum required fields
  const firstSegment = segments[0];
  if (!firstSegment) {
    errors.push('HL7 message must contain at least an MSH segment');
    return { valid: false, errors };
  }

  const mshFields = firstSegment.split(fieldSeparator);
  if (mshFields.length < 9) {
    errors.push('MSH segment must have at least 9 fields (sending app, sending facility, receiving app, receiving facility, datetime, message type, control id, processing id, version)');
  }

  // Check for message type in MSH-9
  if (mshFields.length >= 9) {
    const messageType = mshFields[8];
    if (!messageType || messageType.length === 0) {
      errors.push('MSH-9 (Message Type) is required');
    }
  }

  // Check for message control ID in MSH-10
  if (mshFields.length >= 10) {
    const controlId = mshFields[9];
    if (!controlId || controlId.length === 0) {
      errors.push('MSH-10 (Message Control ID) is required');
    }
  }

  // Check for valid version in MSH-12
  if (mshFields.length >= 12) {
    const version = mshFields[11];
    const validVersions = ['2.1', '2.2', '2.3', '2.3.1', '2.4', '2.5', '2.5.1', '2.6', '2.7', '2.8'];
    if (version && !validVersions.includes(version)) {
      errors.push(`MSH-12 version "${version}" is not a recognized HL7v2 version`);
    }
  }

  // Validate each segment starts with a 3-character segment name
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    const segName = segment.substring(0, 3);
    if (!/^[A-Z][A-Z0-9]{2}$/.test(segName)) {
      errors.push(`Segment ${i + 1} has invalid segment name: "${segName}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates basic FHIR resource structure.
 * Checks for resourceType and required fields based on resource type.
 */
export function validateFHIRResource(resource: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors: ['FHIR resource must be a non-null object'] };
  }

  // Must have resourceType
  const resourceType = resource['resourceType'];
  if (!resourceType || typeof resourceType !== 'string') {
    errors.push('FHIR resource must have a resourceType string');
    return { valid: false, errors };
  }

  // Validate based on resource type
  switch (resourceType) {
    case 'Patient': {
      const name = resource['name'];
      const identifier = resource['identifier'];
      const hasName = Array.isArray(name) && name.length > 0;
      const hasIdentifier = Array.isArray(identifier) && identifier.length > 0;
      if (!hasName && !hasIdentifier) {
        errors.push('Patient resource should have at least a name or identifier');
      }
      break;
    }

    case 'ServiceRequest': {
      if (!resource['status']) {
        errors.push('ServiceRequest must have a status');
      }
      if (!resource['intent']) {
        errors.push('ServiceRequest must have an intent');
      }
      if (!resource['subject']) {
        errors.push('ServiceRequest must have a subject reference');
      }
      break;
    }

    case 'DiagnosticReport': {
      if (!resource['status']) {
        errors.push('DiagnosticReport must have a status');
      }
      if (!resource['code']) {
        errors.push('DiagnosticReport must have a code');
      }
      break;
    }

    case 'Practitioner': {
      const name = resource['name'];
      const identifier = resource['identifier'];
      const hasName = Array.isArray(name) && name.length > 0;
      const hasIdentifier = Array.isArray(identifier) && identifier.length > 0;
      if (!hasName && !hasIdentifier) {
        errors.push('Practitioner resource should have at least a name or identifier');
      }
      break;
    }

    case 'Organization': {
      const identifier = resource['identifier'];
      if (!resource['name'] && !(Array.isArray(identifier) && identifier.length > 0)) {
        errors.push('Organization resource should have a name or identifier');
      }
      break;
    }

    case 'Bundle': {
      if (!resource['type']) {
        errors.push('Bundle must have a type');
      }
      break;
    }

    default:
      // Unknown resource types pass basic validation
      break;
  }

  // Validate meta if present
  const meta = resource['meta'];
  if (meta && typeof meta === 'object') {
    const metaObj = meta as Record<string, unknown>;
    const lastUpdated = metaObj['lastUpdated'];
    if (lastUpdated && typeof lastUpdated === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
      if (!dateRegex.test(lastUpdated)) {
        errors.push('meta.lastUpdated must be a valid ISO 8601 date');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

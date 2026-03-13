/**
 * PHI Redaction Utility
 *
 * Redacts Protected Health Information (PHI) from text to prevent
 * PHI leakage in logs, error messages, and other non-secure outputs.
 *
 * Covers HIPAA-defined PHI identifiers including:
 * - Patient names (common patterns)
 * - Dates of birth
 * - Medical Record Numbers (MRNs)
 * - Social Security Numbers (SSNs)
 * - Phone numbers
 * - Email addresses
 * - Street addresses
 * - IP addresses
 */

export interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const PHI_PATTERNS: RedactionPattern[] = [
  // SSN: 123-45-6789 or 123456789
  {
    name: 'SSN',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN REDACTED]',
  },
  {
    name: 'SSN_NO_DASH',
    pattern: /\b(?<!\d)\d{9}(?!\d)\b/g,
    replacement: '[SSN REDACTED]',
  },

  // MRN: common patterns like MRN: 12345, MRN#12345, mrn=ABC-123
  {
    name: 'MRN',
    pattern: /\b(?:MRN|mrn|Medical Record Number|medical record number)\s*[:#=]?\s*[A-Za-z0-9\-]{4,20}\b/gi,
    replacement: '[MRN REDACTED]',
  },

  // Date of birth: DOB: 01/15/1990, dob=1990-01-15, Date of Birth: Jan 15, 1990
  {
    name: 'DOB',
    pattern: /\b(?:DOB|dob|Date of Birth|date of birth|DateOfBirth|birthdate|birth_date|BirthDate)\s*[:#=]?\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/gi,
    replacement: '[DOB REDACTED]',
  },

  // Phone numbers: (555) 123-4567, 555-123-4567, 5551234567, +1-555-123-4567
  {
    name: 'PHONE',
    pattern: /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
    replacement: '[PHONE REDACTED]',
  },

  // Email addresses
  {
    name: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[EMAIL REDACTED]',
  },

  // Street addresses: common patterns with house number + street name
  {
    name: 'ADDRESS',
    pattern: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Way|Ct|Court|Pl|Place|Cir|Circle|Pkwy|Parkway|Ter|Terrace)\.?\b/gi,
    replacement: '[ADDRESS REDACTED]',
  },

  // ZIP codes when labeled
  {
    name: 'ZIP',
    pattern: /\b(?:zip|postal)\s*(?:code)?\s*[:#=]?\s*\d{5}(?:-\d{4})?\b/gi,
    replacement: '[ZIP REDACTED]',
  },

  // Patient name patterns: "Patient: John Doe", "patient_name=Jane Smith"
  {
    name: 'PATIENT_NAME',
    pattern: /\b(?:patient|Patient|PATIENT)\s*(?:name|Name|NAME)?\s*[:#=]?\s*[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+\b/g,
    replacement: '[PATIENT NAME REDACTED]',
  },

  // IP addresses (considered identifiers under HIPAA)
  {
    name: 'IP_ADDRESS',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP REDACTED]',
  },
];

/**
 * Redacts PHI from the given text using known patterns.
 *
 * @param text - The text potentially containing PHI
 * @returns The text with PHI redacted
 */
export function redactPHI(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let redacted = text;

  for (const { pattern, replacement } of PHI_PATTERNS) {
    // Reset regex lastIndex since we reuse global patterns
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

/**
 * Checks whether the given text likely contains PHI.
 *
 * @param text - The text to check
 * @returns true if any PHI pattern matches
 */
export function containsPHI(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  for (const { pattern } of PHI_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the names of PHI categories detected in the text.
 *
 * @param text - The text to analyze
 * @returns Array of detected PHI category names
 */
export function detectPHICategories(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const categories: string[] = [];

  for (const { name, pattern } of PHI_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      categories.push(name);
    }
  }

  return categories;
}

/**
 * Creates a safe logging wrapper that automatically redacts PHI
 * from any string values in the provided data object.
 *
 * @param data - Object with string values to redact
 * @returns A new object with PHI redacted from all string values
 */
export function redactObjectPHI<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result[key] = redactPHI(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactObjectPHI(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' ? redactPHI(item) : item,
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

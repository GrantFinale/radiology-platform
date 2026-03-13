/**
 * Formats a patient name in "Last, First Middle" format.
 */
export function formatPatientName(
  lastName: string,
  firstName: string,
  middleName?: string,
  suffix?: string,
): string {
  let name = `${lastName}, ${firstName}`;
  if (middleName) {
    name += ` ${middleName}`;
  }
  if (suffix) {
    name += `, ${suffix}`;
  }
  return name;
}

/**
 * Formats a date string into the specified format.
 * Supports 'short' (MM/DD/YYYY), 'long' (Month DD, YYYY), 'iso' (YYYY-MM-DD).
 */
export function formatDate(
  date: string | Date,
  format: 'short' | 'long' | 'iso' = 'short',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  switch (format) {
    case 'short':
      return `${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;

    case 'long': {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      return `${months[month]} ${day}, ${year}`;
    }

    case 'iso':
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    default:
      return d.toISOString();
  }
}

/**
 * Formats a Medical Record Number with consistent padding.
 * Pads numeric MRNs to the specified length with leading zeros.
 */
export function formatMRN(mrn: string, padLength: number = 10): string {
  if (!mrn) return '';

  const trimmed = mrn.trim();

  // If purely numeric, pad with leading zeros
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(padLength, '0');
  }

  // Alphanumeric MRNs are returned as-is (uppercase)
  return trimmed.toUpperCase();
}

/**
 * Formats a National Provider Identifier with standard grouping.
 * NPI is displayed as a 10-digit number: XXXXXXXXXX
 */
export function formatNPI(npi: string): string {
  if (!npi) return '';

  const digits = npi.replace(/\D/g, '');

  if (digits.length !== 10) {
    return npi; // Return as-is if not valid length
  }

  return digits;
}

/**
 * Formats a phone number to (XXX) XXX-XXXX format.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone; // Return as-is if not standard US format
}

/**
 * Converts a JavaScript Date to HL7v2 datetime format.
 * HL7 datetime format: YYYYMMDDHHMMSS or YYYYMMDD
 */
export function formatHL7DateTime(
  date: Date | string,
  includeTime: boolean = true,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}${month}${day}`;
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Parses an HL7v2 datetime string into a JavaScript Date.
 * Supports YYYYMMDD, YYYYMMDDHHMM, YYYYMMDDHHMMSS formats.
 */
export function parseHL7DateTime(hl7DateTime: string): Date | null {
  if (!hl7DateTime || typeof hl7DateTime !== 'string') {
    return null;
  }

  const trimmed = hl7DateTime.trim();

  // Remove timezone offset if present (e.g., +0500, -0800)
  const withoutTz = trimmed.replace(/[+-]\d{4}$/, '');

  if (withoutTz.length < 8) {
    return null;
  }

  const year = parseInt(withoutTz.substring(0, 4), 10);
  const month = parseInt(withoutTz.substring(4, 6), 10) - 1;
  const day = parseInt(withoutTz.substring(6, 8), 10);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (withoutTz.length >= 10) {
    hours = parseInt(withoutTz.substring(8, 10), 10);
  }
  if (withoutTz.length >= 12) {
    minutes = parseInt(withoutTz.substring(10, 12), 10);
  }
  if (withoutTz.length >= 14) {
    seconds = parseInt(withoutTz.substring(12, 14), 10);
  }

  const date = new Date(year, month, day, hours, minutes, seconds);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Parses a FHIR date or dateTime string into a JavaScript Date.
 * FHIR dates can be: YYYY, YYYY-MM, YYYY-MM-DD, or full ISO 8601 dateTime.
 */
export function parseFHIRDate(fhirDate: string): Date | null {
  if (!fhirDate || typeof fhirDate !== 'string') {
    return null;
  }

  const trimmed = fhirDate.trim();

  // Year only: YYYY
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(parseInt(trimmed, 10), 0, 1);
  }

  // Year-month: YYYY-MM
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-').map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 1;
    return new Date(year, month - 1, 1);
  }

  // Full date or dateTime: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS...
  const date = new Date(trimmed);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Formats a FHIR dateTime from a JavaScript Date.
 * Returns ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
 */
export function formatFHIRDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  return d.toISOString();
}

/**
 * Formats a CPT code with its description.
 */
export function formatCPTDisplay(code: string, description: string): string {
  return `${code} - ${description}`;
}

/**
 * Formats an ICD-10 code with its description.
 */
export function formatICD10Display(code: string, description: string): string {
  return `${code}: ${description}`;
}

/**
 * Formats an order priority for display.
 */
export function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    STAT: 'STAT (Immediate)',
    URGENT: 'Urgent',
    ASAP: 'ASAP',
    ROUTINE: 'Routine',
  };

  return priorityMap[priority] || priority;
}

/**
 * Formats a confidence score as a percentage string.
 */
export function formatConfidenceScore(score: number): string {
  if (score < 0 || score > 1) {
    return 'Invalid';
  }
  return `${(score * 100).toFixed(1)}%`;
}

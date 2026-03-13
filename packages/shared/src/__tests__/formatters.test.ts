import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPatientName,
  formatDate,
  formatMRN,
  formatNPI,
  formatPhoneNumber,
  formatHL7DateTime,
  parseHL7DateTime,
  parseFHIRDate,
  formatFHIRDateTime,
  formatCPTDisplay,
  formatICD10Display,
  formatPriority,
  formatConfidenceScore,
} from '../utils/formatters';

describe('Formatters', () => {
  describe('formatPatientName', () => {
    it('formats basic last, first', () => {
      assert.equal(formatPatientName('Doe', 'John'), 'Doe, John');
    });

    it('formats with middle name', () => {
      assert.equal(formatPatientName('Doe', 'John', 'Michael'), 'Doe, John Michael');
    });

    it('formats with suffix', () => {
      assert.equal(formatPatientName('Doe', 'John', undefined, 'Jr.'), 'Doe, John, Jr.');
    });

    it('formats with middle name and suffix', () => {
      assert.equal(formatPatientName('Doe', 'John', 'Michael', 'III'), 'Doe, John Michael, III');
    });
  });

  describe('formatDate', () => {
    it('formats a date in short format (MM/DD/YYYY)', () => {
      const result = formatDate(new Date(2024, 0, 15), 'short');
      assert.equal(result, '01/15/2024');
    });

    it('formats a date in long format (Month DD, YYYY)', () => {
      const result = formatDate(new Date(2024, 0, 15), 'long');
      assert.equal(result, 'January 15, 2024');
    });

    it('formats a date in ISO format (YYYY-MM-DD)', () => {
      const result = formatDate(new Date(2024, 0, 15), 'iso');
      assert.equal(result, '2024-01-15');
    });

    it('defaults to short format', () => {
      const result = formatDate(new Date(2024, 5, 1));
      assert.equal(result, '06/01/2024');
    });

    it('accepts string input', () => {
      const result = formatDate('2024-01-15T00:00:00', 'iso');
      assert.equal(result, '2024-01-15');
    });

    it('returns "Invalid Date" for bad input', () => {
      const result = formatDate('not-a-date');
      assert.equal(result, 'Invalid Date');
    });
  });

  describe('formatMRN', () => {
    it('pads numeric MRN to 10 digits', () => {
      assert.equal(formatMRN('12345'), '0000012345');
    });

    it('does not pad already-long numeric MRN', () => {
      assert.equal(formatMRN('1234567890'), '1234567890');
    });

    it('uppercases alphanumeric MRN', () => {
      assert.equal(formatMRN('abc-123'), 'ABC-123');
    });

    it('supports custom pad length', () => {
      assert.equal(formatMRN('123', 6), '000123');
    });

    it('returns empty string for empty input', () => {
      assert.equal(formatMRN(''), '');
    });

    it('trims whitespace', () => {
      assert.equal(formatMRN('  12345  '), '0000012345');
    });
  });

  describe('formatNPI', () => {
    it('returns a 10-digit NPI as-is', () => {
      assert.equal(formatNPI('1234567893'), '1234567893');
    });

    it('strips non-digit characters', () => {
      assert.equal(formatNPI('123-456-7893'), '1234567893');
    });

    it('returns input as-is if not 10 digits after stripping', () => {
      assert.equal(formatNPI('12345'), '12345');
    });

    it('returns empty string for empty input', () => {
      assert.equal(formatNPI(''), '');
    });
  });

  describe('formatPhoneNumber', () => {
    it('formats 10-digit number to (XXX) XXX-XXXX', () => {
      assert.equal(formatPhoneNumber('5551234567'), '(555) 123-4567');
    });

    it('formats 11-digit number starting with 1', () => {
      assert.equal(formatPhoneNumber('15551234567'), '(555) 123-4567');
    });

    it('strips non-digit characters and reformats', () => {
      assert.equal(formatPhoneNumber('(555) 123-4567'), '(555) 123-4567');
    });

    it('returns non-standard format as-is', () => {
      assert.equal(formatPhoneNumber('12345'), '12345');
    });

    it('returns empty string for empty input', () => {
      assert.equal(formatPhoneNumber(''), '');
    });
  });

  describe('formatHL7DateTime', () => {
    it('formats date with time (YYYYMMDDHHMMSS)', () => {
      const d = new Date(2024, 0, 15, 10, 30, 45);
      const result = formatHL7DateTime(d);
      assert.equal(result, '20240115103045');
    });

    it('formats date without time (YYYYMMDD)', () => {
      const d = new Date(2024, 0, 15, 10, 30, 45);
      const result = formatHL7DateTime(d, false);
      assert.equal(result, '20240115');
    });

    it('accepts string input', () => {
      const result = formatHL7DateTime('2024-01-15T10:30:45', true);
      assert.ok(result.startsWith('2024'));
    });

    it('returns empty string for invalid date', () => {
      assert.equal(formatHL7DateTime('not-a-date'), '');
    });
  });

  describe('parseHL7DateTime', () => {
    it('parses YYYYMMDD format', () => {
      const result = parseHL7DateTime('20240115');
      assert.notEqual(result, null);
      assert.equal(result!.getFullYear(), 2024);
      assert.equal(result!.getMonth(), 0); // January
      assert.equal(result!.getDate(), 15);
    });

    it('parses YYYYMMDDHHMM format', () => {
      const result = parseHL7DateTime('202401151030');
      assert.notEqual(result, null);
      assert.equal(result!.getHours(), 10);
      assert.equal(result!.getMinutes(), 30);
    });

    it('parses YYYYMMDDHHMMSS format', () => {
      const result = parseHL7DateTime('20240115103045');
      assert.notEqual(result, null);
      assert.equal(result!.getSeconds(), 45);
    });

    it('handles timezone offset in input', () => {
      const result = parseHL7DateTime('20240115103045+0500');
      assert.notEqual(result, null);
    });

    it('returns null for empty string', () => {
      assert.equal(parseHL7DateTime(''), null);
    });

    it('returns null for null input', () => {
      assert.equal(parseHL7DateTime(null as unknown as string), null);
    });

    it('returns null for string shorter than 8 chars', () => {
      assert.equal(parseHL7DateTime('2024'), null);
    });
  });

  describe('parseFHIRDate', () => {
    it('parses year-only format (YYYY)', () => {
      const result = parseFHIRDate('2024');
      assert.notEqual(result, null);
      assert.equal(result!.getFullYear(), 2024);
      assert.equal(result!.getMonth(), 0);
      assert.equal(result!.getDate(), 1);
    });

    it('parses year-month format (YYYY-MM)', () => {
      const result = parseFHIRDate('2024-06');
      assert.notEqual(result, null);
      assert.equal(result!.getFullYear(), 2024);
      assert.equal(result!.getMonth(), 5); // June
    });

    it('parses full date (YYYY-MM-DD)', () => {
      const result = parseFHIRDate('2024-01-15');
      assert.notEqual(result, null);
      // Use UTC methods since date-only strings are parsed as UTC
      assert.equal(result!.getUTCFullYear(), 2024);
      assert.equal(result!.getUTCMonth(), 0);
      assert.equal(result!.getUTCDate(), 15);
    });

    it('parses full dateTime with timezone', () => {
      const result = parseFHIRDate('2024-01-15T10:30:00Z');
      assert.notEqual(result, null);
    });

    it('returns null for empty string', () => {
      assert.equal(parseFHIRDate(''), null);
    });

    it('returns null for null input', () => {
      assert.equal(parseFHIRDate(null as unknown as string), null);
    });

    it('returns null for invalid date string', () => {
      assert.equal(parseFHIRDate('not-a-date'), null);
    });
  });

  describe('formatFHIRDateTime', () => {
    it('formats a Date to ISO 8601', () => {
      const d = new Date('2024-01-15T10:30:00Z');
      const result = formatFHIRDateTime(d);
      assert.ok(result.includes('2024'));
      assert.ok(result.endsWith('Z'));
    });

    it('accepts string input', () => {
      const result = formatFHIRDateTime('2024-01-15T10:30:00Z');
      assert.ok(result.includes('2024'));
    });

    it('returns empty string for invalid date', () => {
      assert.equal(formatFHIRDateTime('not-a-date'), '');
    });
  });

  describe('formatCPTDisplay', () => {
    it('formats code with description', () => {
      assert.equal(
        formatCPTDisplay('73721', 'MRI Lower Extremity without Contrast'),
        '73721 - MRI Lower Extremity without Contrast',
      );
    });
  });

  describe('formatICD10Display', () => {
    it('formats code with description', () => {
      assert.equal(
        formatICD10Display('M54.5', 'Low back pain'),
        'M54.5: Low back pain',
      );
    });
  });

  describe('formatPriority', () => {
    it('formats STAT', () => {
      assert.equal(formatPriority('STAT'), 'STAT (Immediate)');
    });

    it('formats URGENT', () => {
      assert.equal(formatPriority('URGENT'), 'Urgent');
    });

    it('formats ASAP', () => {
      assert.equal(formatPriority('ASAP'), 'ASAP');
    });

    it('formats ROUTINE', () => {
      assert.equal(formatPriority('ROUTINE'), 'Routine');
    });

    it('returns unknown priority as-is', () => {
      assert.equal(formatPriority('CUSTOM'), 'CUSTOM');
    });
  });

  describe('formatConfidenceScore', () => {
    it('formats 0.95 as 95.0%', () => {
      assert.equal(formatConfidenceScore(0.95), '95.0%');
    });

    it('formats 1.0 as 100.0%', () => {
      assert.equal(formatConfidenceScore(1.0), '100.0%');
    });

    it('formats 0.0 as 0.0%', () => {
      assert.equal(formatConfidenceScore(0.0), '0.0%');
    });

    it('formats 0.123 as 12.3%', () => {
      assert.equal(formatConfidenceScore(0.123), '12.3%');
    });

    it('returns Invalid for negative scores', () => {
      assert.equal(formatConfidenceScore(-0.1), 'Invalid');
    });

    it('returns Invalid for scores greater than 1', () => {
      assert.equal(formatConfidenceScore(1.1), 'Invalid');
    });
  });
});

/**
 * Encryption Utilities for PHI and Sensitive Data
 *
 * Provides AES-256-GCM encryption for field-level encryption of sensitive
 * data at rest, and one-way hashing for building searchable indexes on
 * PHI without storing plaintext.
 *
 * Usage:
 *   const key = generateEncryptionKey();
 *   const encrypted = encryptField('John Doe', key);
 *   const decrypted = decryptField(encrypted, key);
 *
 *   const hash = hashPHI('123-45-6789');
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Encrypted field format:
 * Base64-encoded string containing: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
 */

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param key - A 32-byte (256-bit) encryption key as a hex string or Buffer
 * @returns Base64-encoded string containing IV + AuthTag + Ciphertext
 * @throws Error if the key is invalid or encryption fails
 */
export function encryptField(plaintext: string, key: string | Buffer): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string');
  }

  const keyBuffer = normalizeKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a ciphertext string produced by encryptField.
 *
 * @param ciphertext - Base64-encoded string containing IV + AuthTag + Ciphertext
 * @param key - The same key used to encrypt (32-byte hex string or Buffer)
 * @returns The decrypted plaintext string
 * @throws Error if the key is wrong, data is tampered, or decryption fails
 */
export function decryptField(ciphertext: string, key: string | Buffer): string {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('Ciphertext must be a non-empty string');
  }

  const keyBuffer = normalizeKey(key);
  const combined = Buffer.from(ciphertext, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid ciphertext: data too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generates a one-way HMAC-SHA256 hash of a PHI value.
 * Useful for creating searchable indexes on sensitive data without
 * storing the plaintext.
 *
 * @param value - The PHI value to hash (e.g., SSN, MRN)
 * @param secret - Optional HMAC secret (defaults to a deterministic salt).
 *   In production, use a securely stored secret.
 * @returns Hex-encoded hash string
 */
export function hashPHI(value: string, secret?: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error('Value must be a non-empty string');
  }

  // Normalize the value: trim whitespace, lowercase for consistent hashing
  const normalized = value.trim().toLowerCase();

  const hmacSecret = secret || 'radiology-platform-phi-hash-key';
  const hmac = createHmac('sha256', hmacSecret);
  hmac.update(normalized);
  return hmac.digest('hex');
}

/**
 * Generates a random 256-bit encryption key.
 *
 * @returns A 64-character hex string representing a 32-byte key
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Derives a 256-bit encryption key from a password using scrypt.
 * Suitable for key derivation from user-provided passwords.
 *
 * @param password - The password to derive a key from
 * @param salt - Optional salt (random bytes generated if not provided)
 * @returns Object containing the derived key (hex) and salt (hex)
 */
export function deriveKey(
  password: string,
  salt?: string,
): { key: string; salt: string } {
  const saltBuffer = salt
    ? Buffer.from(salt, 'hex')
    : randomBytes(SALT_LENGTH);

  const derived = scryptSync(password, saltBuffer, KEY_LENGTH);

  return {
    key: derived.toString('hex'),
    salt: saltBuffer.toString('hex'),
  };
}

/**
 * Normalize the key input to a 32-byte Buffer.
 */
function normalizeKey(key: string | Buffer): Buffer {
  if (Buffer.isBuffer(key)) {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Encryption key must be ${KEY_LENGTH} bytes, got ${key.length}`);
    }
    return key;
  }

  if (typeof key === 'string') {
    // Assume hex-encoded key
    const buf = Buffer.from(key, 'hex');
    if (buf.length !== KEY_LENGTH) {
      throw new Error(
        `Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${buf.length} bytes`,
      );
    }
    return buf;
  }

  throw new Error('Key must be a hex string or Buffer');
}

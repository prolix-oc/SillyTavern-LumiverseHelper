/**
 * Crypto Utilities Module
 * Provides AES encryption/decryption for sensitive fields at rest.
 *
 * This is obfuscation-at-rest (not vault-grade security) — it prevents
 * accidental exposure in backups, exports, or settings files.
 * Uses crypto-js which works over HTTP (no Web Crypto API dependency).
 */

import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

// Deterministic app key for obfuscation-at-rest
const APP_KEY = 'lumiverse-helper-key-v1';

// Prefix sentinel — encrypted values are stored as 'enc:' + ciphertext
const ENC_PREFIX = 'enc:';

/**
 * Encrypt a plaintext value for storage.
 * Returns unchanged if falsy or already encrypted.
 * @param {string} plaintext - Value to encrypt
 * @returns {string} Encrypted value with 'enc:' prefix, or original if falsy/already encrypted
 */
export function encryptValue(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return plaintext;
    if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // Already encrypted
    const ciphertext = AES.encrypt(plaintext, APP_KEY).toString();
    return ENC_PREFIX + ciphertext;
}

/**
 * Decrypt an encrypted value.
 * Returns unchanged if no 'enc:' prefix (safe on legacy plaintext).
 * @param {string} ciphertext - Value to decrypt (with 'enc:' prefix)
 * @returns {string} Decrypted plaintext, or original if not encrypted
 */
export function decryptValue(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
    if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext; // Plaintext passthrough
    const raw = ciphertext.slice(ENC_PREFIX.length);
    try {
        const bytes = AES.decrypt(raw, APP_KEY);
        const decrypted = bytes.toString(Utf8);
        // If decryption produced empty string, return original (corrupt data safety)
        return decrypted || ciphertext;
    } catch (e) {
        console.warn('[cryptoUtils] Decryption failed, returning original value');
        return ciphertext;
    }
}

/**
 * Check if a value is encrypted (has 'enc:' prefix).
 * @param {string} value - Value to check
 * @returns {boolean} True if encrypted
 */
export function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

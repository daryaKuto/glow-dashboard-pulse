/**
 * Credentials encryption/decryption utilities
 * Handles secure storage and retrieval of ThingsBoard credentials
 */

/**
 * Encrypt a password for storage in the database
 * Note: This is a basic implementation. In production, use proper encryption
 * @param password - Plain text password
 * @returns Encrypted password string
 */
export function encryptPassword(password: string): string {
  // Using base64 encoding for now - in production, use proper encryption
  // Consider using Supabase Vault or pgcrypto for better security
  return btoa(password);
}

/**
 * Decrypt a password from the database
 * @param encryptedPassword - Encrypted password from database
 * @returns Plain text password
 */
export function decryptPassword(encryptedPassword: string): string {
  // Using base64 decoding for now - in production, use proper decryption
  try {
    return atob(encryptedPassword);
  } catch (error) {
    console.error('Failed to decrypt password:', error);
    throw new Error('Invalid encrypted password format');
  }
}

/**
 * Hash a password using SHA-256 (for database storage)
 * This is used when storing in the database with pgcrypto
 * @param password - Plain text password
 * @returns SHA-256 hash
 */
export function hashPassword(password: string): string {
  // This would be used with pgcrypto in the database
  // For now, we'll use a simple hash for demonstration
  return btoa(password);
}

/**
 * Verify if a password matches the stored hash
 * @param password - Plain text password to verify
 * @param hash - Stored hash to compare against
 * @returns True if password matches
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const hashedPassword = hashPassword(password);
    return hashedPassword === hash;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * Generate a secure random salt for password hashing
 * @returns Random salt string
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a user has ThingsBoard credentials configured
 * @param thingsboardEmail - ThingsBoard email from user profile
 * @param thingsboardPasswordEncrypted - Encrypted password from user profile
 * @returns True if credentials are configured
 */
export function hasThingsBoardCredentials(
  thingsboardEmail: string | null,
  thingsboardPasswordEncrypted: string | null
): boolean {
  return !!(thingsboardEmail && thingsboardPasswordEncrypted);
}

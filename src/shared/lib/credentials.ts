/**
 * Credentials encryption/decryption utilities
 * Handles secure storage and retrieval of ThingsBoard credentials
 *
 * Uses Web Crypto API (AES-GCM) for proper encryption.
 * TODO: Migrate to server-side encryption via Supabase Vault for production.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Derive a CryptoKey from a passphrase using PBKDF2.
 * Uses a static salt derived from the app's Supabase URL to keep it deterministic
 * per deployment without hardcoding a secret.
 */
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = encoder.encode('glow-dashboard-credentials-salt');

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get a stable passphrase for key derivation.
 * Uses the Supabase URL as a deployment-specific input.
 */
function getPassphrase(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'default-passphrase';
  return `glow-cred-key-${supabaseUrl}`;
}

/**
 * Encrypt a password for storage in the database using AES-GCM.
 * Returns a base64 string containing IV + ciphertext.
 */
export async function encryptPassword(password: string): Promise<string> {
  const key = await deriveKey(getPassphrase());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(password)
  );

  // Concatenate IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a password from the database using AES-GCM.
 * Accepts the base64 string produced by encryptPassword.
 * Also supports legacy base64-only values for backward compatibility.
 */
export async function decryptPassword(encryptedPassword: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encryptedPassword), (c) => c.charCodeAt(0));

    // Legacy values are plain base64 (no IV prefix).
    // AES-GCM ciphertext is always longer than plain text + 12 byte IV + 16 byte auth tag = 28+ bytes overhead.
    // If the decoded length is short enough to be raw text, treat as legacy.
    if (combined.length < IV_LENGTH + 16 + 1) {
      // Legacy base64 encoding — return decoded plaintext
      return new TextDecoder().decode(combined);
    }

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const key = await deriveKey(getPassphrase());

    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    // If AES-GCM decryption fails, try legacy base64 decode
    try {
      return atob(encryptedPassword);
    } catch {
      throw new Error('Invalid encrypted password format');
    }
  }
}

/**
 * Check if a user has ThingsBoard credentials configured
 */
export function hasThingsBoardCredentials(
  thingsboardEmail: string | null,
  thingsboardPasswordEncrypted: string | null
): boolean {
  return !!(thingsboardEmail && thingsboardPasswordEncrypted);
}

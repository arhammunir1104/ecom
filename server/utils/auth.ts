import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

/**
 * Hash a password with a random salt using scrypt
 * @param password The plain text password to hash
 * @returns A string in the format "hash.salt" where both hash and salt are hex strings
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt (16 bytes → 32 hex chars)
  const salt = randomBytes(16).toString("hex");
  
  // Hash the password with the salt (output is 64 bytes → 128 hex chars)
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  
  // Return the hash and salt concatenated with a separator
  return `${derivedKey.toString("hex")}.${salt}`;
}

/**
 * Compare a password against a stored hash
 * @param suppliedPassword The plain text password to check
 * @param storedHash The stored password hash in the format "hash.salt"
 * @returns True if the password matches, false otherwise
 */
export async function comparePasswords(suppliedPassword: string, storedHash: string): Promise<boolean> {
  // Split the stored hash into the hash and the salt
  const [hashedPassword, salt] = storedHash.split(".");
  
  // If either part is missing, the stored hash is invalid
  if (!hashedPassword || !salt) {
    return false;
  }
  
  // Hash the supplied password with the same salt
  const suppliedHash = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer;
  const storedHashBuffer = Buffer.from(hashedPassword, "hex");
  
  // Compare the hashes in constant time to prevent timing attacks
  return timingSafeEqual(suppliedHash, storedHashBuffer);
}

/**
 * Generate a random secure token
 * @param byteLength Length of the token in bytes (default: 32)
 * @returns A random hex string
 */
export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}
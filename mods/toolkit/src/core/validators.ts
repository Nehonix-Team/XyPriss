import { ERROR_MESSAGES } from '../utils/constants';

/**
 * Validation utilities for security-related inputs
 */
export class Validators {
  /**
   * Validate a token length
   * @param length - The length to validate
   * @param minLength - Minimum allowed length
   * @param maxLength - Maximum allowed length
   * @throws Error if the length is invalid
   */
  public static validateLength(
    length: number,
    minLength: number = 1,
    maxLength: number = 1024
  ): void {
    if (typeof length !== 'number' || isNaN(length)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_LENGTH}: must be a number`);
    }
    
    if (length < minLength) {
      throw new Error(`${ERROR_MESSAGES.INVALID_LENGTH}: must be at least ${minLength}`);
    }
    
    if (length > maxLength) {
      throw new Error(`${ERROR_MESSAGES.INVALID_LENGTH}: must be at most ${maxLength}`);
    }
  }
  
  /**
   * Validate a hash algorithm
   * @param algorithm - The algorithm to validate
   * @param allowedAlgorithms - List of allowed algorithms
   * @throws Error if the algorithm is invalid
   */
  public static validateAlgorithm(
    algorithm: string,
    allowedAlgorithms: string[] = ['sha256', 'sha512', 'sha3', 'blake3']
  ): void {
    if (!algorithm || typeof algorithm !== 'string') {
      throw new Error(`${ERROR_MESSAGES.INVALID_ALGORITHM}: must be a string`);
    }
    
    if (!allowedAlgorithms.includes(algorithm.toLowerCase())) {
      throw new Error(
        `${ERROR_MESSAGES.INVALID_ALGORITHM}: must be one of ${allowedAlgorithms.join(', ')}`
      );
    }
  }
  
  /**
   * Validate iteration count
   * @param iterations - The iteration count to validate
   * @param minIterations - Minimum allowed iterations
   * @param maxIterations - Maximum allowed iterations
   * @throws Error if the iteration count is invalid
   */
  public static validateIterations(
    iterations: number,
    minIterations: number = 1,
    maxIterations: number = 1000000
  ): void {
    if (typeof iterations !== 'number' || isNaN(iterations)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_ITERATIONS}: must be a number`);
    }
    
    if (iterations < minIterations) {
      throw new Error(`${ERROR_MESSAGES.INVALID_ITERATIONS}: must be at least ${minIterations}`);
    }
    
    if (iterations > maxIterations) {
      throw new Error(`${ERROR_MESSAGES.INVALID_ITERATIONS}: must be at most ${maxIterations}`);
    }
  }
  
  /**
   * Validate a salt
   * @param salt - The salt to validate
   * @throws Error if the salt is invalid
   */
  public static validateSalt(salt: string | Uint8Array): void {
    if (!salt) {
      throw new Error(`${ERROR_MESSAGES.INVALID_SALT}: cannot be empty`);
    }
    
    if (typeof salt === 'string') {
      if (salt.length === 0) {
        throw new Error(`${ERROR_MESSAGES.INVALID_SALT}: cannot be empty`);
      }
    } else if (salt instanceof Uint8Array) {
      if (salt.length === 0) {
        throw new Error(`${ERROR_MESSAGES.INVALID_SALT}: cannot be empty`);
      }
    } else {
      throw new Error(`${ERROR_MESSAGES.INVALID_SALT}: must be a string or Uint8Array`);
    }
  }
  
  /**
   * Validate an output format
   * @param format - The format to validate
   * @param allowedFormats - List of allowed formats
   * @throws Error if the format is invalid
   */
  public static validateOutputFormat(
    format: string,
    allowedFormats: string[] = ['hex', 'base64', 'base58', 'buffer']
  ): void {
    if (!format || typeof format !== 'string') {
      throw new Error(`${ERROR_MESSAGES.INVALID_FORMAT}: must be a string`);
    }
    
    if (!allowedFormats.includes(format.toLowerCase())) {
      throw new Error(
        `${ERROR_MESSAGES.INVALID_FORMAT}: must be one of ${allowedFormats.join(', ')}`
      );
    }
  }
  
  /**
   * Validate an entropy level
   * @param entropy - The entropy level to validate
   * @param allowedLevels - List of allowed entropy levels
   * @throws Error if the entropy level is invalid
   */
  public static validateEntropyLevel(
    entropy: string,
    allowedLevels: string[] = ['standard', 'high', 'maximum']
  ): void {
    if (!entropy || typeof entropy !== 'string') {
      throw new Error(`${ERROR_MESSAGES.INVALID_ENTROPY}: must be a string`);
    }
    
    if (!allowedLevels.includes(entropy.toLowerCase())) {
      throw new Error(
        `${ERROR_MESSAGES.INVALID_ENTROPY}: must be one of ${allowedLevels.join(', ')}`
      );
    }
  }
  
  /**
   * Validate an API key format
   * @param apiKey - The API key to validate
   * @param expectedPrefix - Optional expected prefix
   * @throws Error if the API key format is invalid
   */
  public static validateAPIKey(apiKey: string, expectedPrefix?: string): void {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error(`${ERROR_MESSAGES.INVALID_API_KEY}: must be a string`);
    }
    
    // Check for expected format: prefix_timestamp_randomPart
    const parts = apiKey.split('_');
    if (parts.length !== 3) {
      throw new Error(`${ERROR_MESSAGES.INVALID_API_KEY}: invalid format`);
    }
    
    // Check prefix if specified
    if (expectedPrefix && parts[0] !== expectedPrefix) {
      throw new Error(`${ERROR_MESSAGES.INVALID_API_KEY}: invalid prefix`);
    }
    
    // Check timestamp part (should be a valid hex timestamp)
    const timestamp = parts[1];
    if (!/^[0-9a-f]{8}$/.test(timestamp)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_API_KEY}: invalid timestamp`);
    }
    
    // Check random part (should be at least 16 chars)
    const randomPart = parts[2];
    if (randomPart.length < 16) {
      throw new Error(`${ERROR_MESSAGES.INVALID_API_KEY}: invalid random part`);
    }
  }
  
  /**
   * Validate a session token format
   * @param token - The session token to validate
   * @throws Error if the session token format is invalid
   */
  public static validateSessionToken(token: string): void {
    if (!token || typeof token !== 'string') {
      throw new Error(`${ERROR_MESSAGES.INVALID_SESSION_TOKEN}: must be a string`);
    }
    
    // Check for expected format: timestamp.nonce.data.signature
    const parts = token.split('.');
    if (parts.length !== 4) {
      throw new Error(`${ERROR_MESSAGES.INVALID_SESSION_TOKEN}: invalid format`);
    }
    
    // Check timestamp part (should be a valid number)
    const timestamp = parseInt(parts[0], 10);
    if (isNaN(timestamp)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_SESSION_TOKEN}: invalid timestamp`);
    }
    
    // Check signature part (should be at least 32 chars)
    const signature = parts[3];
    if (signature.length < 32) {
      throw new Error(`${ERROR_MESSAGES.INVALID_SESSION_TOKEN}: invalid signature`);
    }
  }
  
  /**
   * Validate a password strength
   * @param password - The password to validate
   * @param minLength - Minimum required length
   * @param requireUppercase - Whether uppercase letters are required
   * @param requireLowercase - Whether lowercase letters are required
   * @param requireNumbers - Whether numbers are required
   * @param requireSymbols - Whether symbols are required
   * @throws Error if the password is too weak
   */
  public static validatePasswordStrength(
    password: string,
    minLength: number = 8,
    requireUppercase: boolean = true,
    requireLowercase: boolean = true,
    requireNumbers: boolean = true,
    requireSymbols: boolean = false
  ): void {
    if (!password || typeof password !== 'string') {
      throw new Error(`${ERROR_MESSAGES.WEAK_PASSWORD}: must be a string`);
    }
    
    // Check length
    if (password.length < minLength) {
      throw new Error(`${ERROR_MESSAGES.WEAK_PASSWORD}: must be at least ${minLength} characters long`);
    }
    
    // Check for required character types
    if (requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error(`${ERROR_MESSAGES.WEAK_PASSWORD}: must contain at least one uppercase letter`);
    }
    
    if (requireLowercase && !/[a-z]/.test(password)) {
      throw new Error(`${ERROR_MESSAGES.WEAK_PASSWORD}: must contain at least one lowercase letter`);
    }
    
    if (requireNumbers && !/[0-9]/.test(password)) {
      throw new Error(`${ERROR_MESSAGES.WEAK_PASSWORD}: must contain at least one number`);
    }
    
    if (requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
      throw new Error(`${ERROR_MESSAGES.WEAK_PASSWORD}: must contain at least one symbol`);
    }
  }
}

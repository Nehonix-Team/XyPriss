/**
 * Statistics for cryptographic operations
 */
export interface CryptoStats {
  /**
   * Number of tokens generated
   */
  tokensGenerated: number;
  
  /**
   * Number of hashes computed
   */
  hashesComputed: number;
  
  /**
   * Number of keys derived
   */
  keysDerivated: number;
  
  /**
   * Average entropy bits across all operations
   */
  averageEntropyBits: number;
  
  /**
   * Timestamp of the last operation
   */
  lastOperationTime: string;
  
  /**
   * Performance metrics for different operations
   */
  performance: {
    /**
     * Average time for token generation in milliseconds
     */
    tokenGenerationAvgMs: number;
    
    /**
     * Average time for hash computation in milliseconds
     */
    hashComputationAvgMs: number;
    
    /**
     * Average time for key derivation in milliseconds
     */
    keyDerivationAvgMs: number;
  };
  
  /**
   * Memory usage statistics
   */
  memory: {
    /**
     * Peak memory usage in bytes
     */
    peakUsageBytes: number;
    
    /**
     * Average memory usage in bytes
     */
    averageUsageBytes: number;
  };
}

/**
 * Result of a security test
 */
export interface SecurityTestResult {
  /**
   * Number of tests passed
   */
  passed: number;
  
  /**
   * Number of tests failed
   */
  failed: number;
  
  /**
   * Detailed results for each test
   */
  results: Array<{
    /**
     * Name of the test
     */
    test: string;
    
    /**
     * Whether the test passed
     */
    passed: boolean;
    
    /**
     * Message describing the test result
     */
    message: string;
    
    /**
     * Additional details about the test
     */
    details?: any;
  }>;
}

/**
 * Password strength analysis result
 */
export interface PasswordStrengthResult {
  /**
   * Strength score from 0-100
   */
  score: number;
  
  /**
   * Feedback messages for improving the password
   */
  feedback: string[];
  
  /**
   * Estimated time to crack the password
   */
  estimatedCrackTime: string;
  
  /**
   * Detailed analysis of the password
   */
  analysis: {
    /**
     * Length score
     */
    length: number;
    
    /**
     * Entropy score
     */
    entropy: number;
    
    /**
     * Character variety score
     */
    variety: number;
    
    /**
     * Pattern detection score (lower is better)
     */
    patterns: number;
  };
}

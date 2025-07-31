/**
 * Comparison Operations Module
 * Handles secure string comparison operations
 */
 
import { ComparisonResult } from "../types";
  
/**
 * Handles secure string comparison operations
 */
export class ComparisonOperations {
    /**
     * Performs constant-time string comparison to prevent timing attacks
     */
    static constantTimeEquals(str1: string, str2: string): ComparisonResult {
        const startTime = performance.now();
        
        // Ensure both strings are the same length for constant-time comparison
        const maxLength = Math.max(str1.length, str2.length);
        
        // Pad shorter string with null characters
        const paddedStr1 = str1.padEnd(maxLength, '\0');
        const paddedStr2 = str2.padEnd(maxLength, '\0');
        
        let result = 0;
        
        // XOR each character - if strings are equal, result will remain 0
        for (let i = 0; i < maxLength; i++) {
            result |= paddedStr1.charCodeAt(i) ^ paddedStr2.charCodeAt(i);
        }
        
        const endTime = performance.now();
        const isEqual = result === 0 && str1.length === str2.length;
        
        return {
            isEqual,
            timeTaken: endTime - startTime,
            constantTime: true,
        };
    }

    /**
     * Regular string comparison (faster but potentially vulnerable to timing attacks)
     */
    static regularEquals(str1: string, str2: string): ComparisonResult {
        const startTime = performance.now();
        const isEqual = str1 === str2;
        const endTime = performance.now();
        
        return {
            isEqual,
            timeTaken: endTime - startTime,
            constantTime: false,
        };
    }

    /**
     * Case-insensitive constant-time comparison
     */
    static constantTimeEqualsIgnoreCase(str1: string, str2: string): ComparisonResult {
        return this.constantTimeEquals(str1.toLowerCase(), str2.toLowerCase());
    }

    /**
     * Compares strings lexicographically
     */
    static compare(str1: string, str2: string): number {
        if (str1 < str2) return -1;
        if (str1 > str2) return 1;
        return 0;
    }

    /**
     * Case-insensitive lexicographic comparison
     */
    static compareIgnoreCase(str1: string, str2: string): number {
        return this.compare(str1.toLowerCase(), str2.toLowerCase());
    }

    /**
     * Compares strings using locale-specific rules
     */
    static localeCompare(
        str1: string, 
        str2: string, 
        locales?: string | string[], 
        options?: Intl.CollatorOptions
    ): number {
        return str1.localeCompare(str2, locales, options);
    }

    /**
     * Checks if two strings are similar within a threshold
     */
    static isSimilar(
        str1: string, 
        str2: string, 
        threshold: number = 0.8
    ): boolean {
        const similarity = this.calculateSimilarity(str1, str2);
        return similarity >= threshold;
    }

    /**
     * Calculates similarity between two strings using Levenshtein distance
     */
    static calculateSimilarity(str1: string, str2: string): number {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        
        if (maxLength === 0) return 1; // Both strings are empty
        
        return 1 - (distance / maxLength);
    }

    /**
     * Calculates Levenshtein distance between two strings
     */
    static levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];
        
        // Initialize matrix
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        // Fill matrix
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Calculates Hamming distance (for strings of equal length)
     */
    static hammingDistance(str1: string, str2: string): number {
        if (str1.length !== str2.length) {
            throw new Error("Hamming distance requires strings of equal length");
        }
        
        let distance = 0;
        for (let i = 0; i < str1.length; i++) {
            if (str1.charAt(i) !== str2.charAt(i)) {
                distance++;
            }
        }
        
        return distance;
    }

    /**
     * Calculates Jaro similarity
     */
    static jaroSimilarity(str1: string, str2: string): number {
        if (str1.length === 0 && str2.length === 0) return 1;
        if (str1.length === 0 || str2.length === 0) return 0;
        
        const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
        const str1Matches = new Array(str1.length).fill(false);
        const str2Matches = new Array(str2.length).fill(false);
        
        let matches = 0;
        let transpositions = 0;
        
        // Find matches
        for (let i = 0; i < str1.length; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, str2.length);
            
            for (let j = start; j < end; j++) {
                if (str2Matches[j] || str1.charAt(i) !== str2.charAt(j)) continue;
                
                str1Matches[i] = true;
                str2Matches[j] = true;
                matches++;
                break;
            }
        }
        
        if (matches === 0) return 0;
        
        // Count transpositions
        let k = 0;
        for (let i = 0; i < str1.length; i++) {
            if (!str1Matches[i]) continue;
            
            while (!str2Matches[k]) k++;
            
            if (str1.charAt(i) !== str2.charAt(k)) transpositions++;
            k++;
        }
        
        return (matches / str1.length + matches / str2.length + 
                (matches - transpositions / 2) / matches) / 3;
    }

    /**
     * Calculates Jaro-Winkler similarity
     */
    static jaroWinklerSimilarity(str1: string, str2: string, prefixScale: number = 0.1): number {
        const jaroSim = this.jaroSimilarity(str1, str2);
        
        if (jaroSim < 0.7) return jaroSim;
        
        // Calculate common prefix length (up to 4 characters)
        let prefixLength = 0;
        for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
            if (str1.charAt(i) === str2.charAt(i)) {
                prefixLength++;
            } else {
                break;
            }
        }
        
        return jaroSim + (prefixLength * prefixScale * (1 - jaroSim));
    }

    /**
     * Performs fuzzy matching with multiple algorithms
     */
    static fuzzyMatch(
        str1: string, 
        str2: string, 
        algorithm: 'levenshtein' | 'jaro' | 'jaro-winkler' = 'levenshtein'
    ): number {
        switch (algorithm) {
            case 'levenshtein':
                return this.calculateSimilarity(str1, str2);
            case 'jaro':
                return this.jaroSimilarity(str1, str2);
            case 'jaro-winkler':
                return this.jaroWinklerSimilarity(str1, str2);
            default:
                throw new Error(`Unsupported fuzzy matching algorithm: ${algorithm}`);
        }
    }

    /**
     * Checks if strings match with a given tolerance
     */
    static matchesWithTolerance(
        str1: string, 
        str2: string, 
        tolerance: number = 0.8,
        algorithm: 'levenshtein' | 'jaro' | 'jaro-winkler' = 'levenshtein'
    ): boolean {
        const similarity = this.fuzzyMatch(str1, str2, algorithm);
        return similarity >= tolerance;
    }
}

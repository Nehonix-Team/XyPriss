/**
 * Robust Error Handling Utilities for XyPrissSecurity
 * Enhanced error handling with security considerations
 */

export enum ErrorType {
    VALIDATION = "VALIDATION",
    CRYPTOGRAPHIC = "CRYPTOGRAPHIC",
    AUTHENTICATION = "AUTHENTICATION",
    AUTHORIZATION = "AUTHORIZATION",
    NETWORK = "NETWORK",
    CONFIGURATION = "CONFIGURATION",
    RATE_LIMIT = "RATE_LIMIT",
    INTERNAL = "INTERNAL",
    SCALING = "SCALING",
}

export enum ErrorSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL",
}

export interface ErrorContext {
    operation: string;
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    additionalData?: Record<string, any>;
}

export interface SecurityError extends Error {
    type: ErrorType;
    severity: ErrorSeverity;
    code: string;
    context: ErrorContext;
    isRetryable: boolean;
    sanitizedMessage: string; // Safe for client display
}

/**
 * Create a security-aware error
 */
export function createSecurityError(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity,
    code: string,
    context: Partial<ErrorContext>,
    isRetryable: boolean = false
): SecurityError {
    const error = new Error(message) as SecurityError;
    error.type = type;
    error.severity = severity;
    error.code = code;
    error.context = {
        operation: context.operation || "unknown",
        timestamp: new Date(),
        ...context,
    };
    error.isRetryable = isRetryable;
    error.sanitizedMessage = sanitizeErrorMessage(message, type);

    return error;
}

/**
 * Sanitize error messages to prevent information leakage
 */
function sanitizeErrorMessage(message: string, type: ErrorType): string {
    // Remove sensitive information from error messages
    const sensitivePatterns = [
        /password/gi,
        /key/gi,
        /token/gi,
        /secret/gi,
        /private/gi,
        /\b\d{4,}\b/g, // Numbers that might be keys/tokens
        /[A-Za-z0-9+/]{20,}/g, // Base64-like strings
    ];

    let sanitized = message;

    // For authentication/authorization errors, use generic messages
    if (type === ErrorType.AUTHENTICATION || type === ErrorType.AUTHORIZATION) {
        return "Authentication failed. Please check your credentials.";
    }

    // For cryptographic errors, provide helpful but not revealing messages
    if (type === ErrorType.CRYPTOGRAPHIC) {
        if (message.toLowerCase().includes("decrypt")) {
            return "Decryption failed. Please verify your password or key.";
        }
        if (message.toLowerCase().includes("encrypt")) {
            return "Encryption failed. Please check your input data.";
        }
        if (message.toLowerCase().includes("key")) {
            return "Invalid key format or size.";
        }
        return "Cryptographic operation failed.";
    }

    // Remove sensitive patterns from other error types
    for (const pattern of sensitivePatterns) {
        sanitized = sanitized.replace(pattern, "[REDACTED]");
    }

    return sanitized;
}

/**
 * Error retry utility with exponential backoff
 */
export class ErrorRetryHandler {
    private maxRetries: number;
    private baseDelay: number;
    private maxDelay: number;

    constructor(
        maxRetries: number = 3,
        baseDelay: number = 1000,
        maxDelay: number = 30000
    ) {
        this.maxRetries = maxRetries;
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
    }

    /**
     * Execute operation with retry logic
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: Partial<ErrorContext>,
        isRetryableError: (error: any) => boolean = () => true
    ): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;

                // Don't retry if error is not retryable
                if (!isRetryableError(error) || attempt === this.maxRetries) {
                    break;
                }

                // Calculate delay with exponential backoff and jitter
                const delay = Math.min(
                    this.baseDelay * Math.pow(2, attempt) +
                        Math.random() * 1000,
                    this.maxDelay
                );

                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        // If we get here, all retries failed
        throw createSecurityError(
            `Operation failed after ${this.maxRetries + 1} attempts: ${
                lastError.message
            }`,
            ErrorType.INTERNAL,
            ErrorSeverity.HIGH,
            "RETRY_EXHAUSTED",
            context
        );
    }
}

/**
 * Error logging utility with security considerations
 */
export class SecurityErrorLogger {
    private logSensitiveData: boolean;

    constructor(logSensitiveData: boolean = false) {
        this.logSensitiveData = logSensitiveData;
    }

    /**
     * Log security error with appropriate level of detail
     */
    logError(error: SecurityError): void {
        const logEntry = {
            timestamp: error.context.timestamp.toISOString(),
            type: error.type,
            severity: error.severity,
            code: error.code,
            operation: error.context.operation,
            message: this.logSensitiveData
                ? error.message
                : error.sanitizedMessage,
            userId: error.context.userId,
            sessionId: error.context.sessionId,
            ipAddress: error.context.ipAddress,
            isRetryable: error.isRetryable,
        };

        // Log based on severity
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                console.error("CRITICAL SECURITY ERROR:", logEntry);
                break;
            case ErrorSeverity.HIGH:
                console.error("HIGH SEVERITY ERROR:", logEntry);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn("MEDIUM SEVERITY ERROR:", logEntry);
                break;
            case ErrorSeverity.LOW:
                console.info("LOW SEVERITY ERROR:", logEntry);
                break;
        }

        // Additional alerting for critical errors
        if (error.severity === ErrorSeverity.CRITICAL) {
            this.alertCriticalError(error);
        }
    }

    private alertCriticalError(error: SecurityError): void {
        //TODO: In a real implementation, this would send alerts to monitoring systems (like smartlogger)
        // for now, we'll just display in the user log (I think it not a good idea)
        // so my suggestion is to just display error without show details
        console.error("CRITICAL ERROR ALERT - IMMEDIATE ATTENTION REQUIRED:", {
            code: error.code,
            operation: error.context.operation,
            timestamp: error.context.timestamp,
        });
    }
}

/**
 * Circuit breaker pattern for error handling
 */
export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000, // 1 minute
        private monitoringPeriod: number = 300000 // 5 minutes
    ) {}

    /**
     * Execute operation through circuit breaker
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === "OPEN") {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = "HALF_OPEN";
            } else {
                throw createSecurityError(
                    "Circuit breaker is OPEN - service temporarily unavailable",
                    ErrorType.INTERNAL,
                    ErrorSeverity.MEDIUM,
                    "CIRCUIT_BREAKER_OPEN",
                    { operation: "circuit_breaker" }
                );
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = "CLOSED";
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = "OPEN";
        }
    }

    getState(): string {
        return this.state;
    }

    getFailureCount(): number {
        return this.failures;
    }

    reset(): void {
        this.failures = 0;
        this.state = "CLOSED";
        this.lastFailureTime = 0;
    }
}

/**
 * Validation error helpers
 */
export function createValidationError(
    field: string,
    value: any,
    constraint: string,
    context: Partial<ErrorContext>
): SecurityError {
    return createSecurityError(
        `Validation failed for field '${field}': ${constraint}`,
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        "VALIDATION_FAILED",
        context
    );
}

/**
 * Cryptographic error helpers
 */
export function createCryptographicError(
    operation: string,
    reason: string,
    context: Partial<ErrorContext>
): SecurityError {
    return createSecurityError(
        `Cryptographic operation '${operation}' failed: ${reason}`,
        ErrorType.CRYPTOGRAPHIC,
        ErrorSeverity.HIGH,
        "CRYPTO_OPERATION_FAILED",
        context
    );
}

/**
 * Rate limiting error helper
 */
export function createRateLimitError(
    identifier: string,
    context: Partial<ErrorContext>
): SecurityError {
    return createSecurityError(
        `Rate limit exceeded for ${identifier}`,
        ErrorType.RATE_LIMIT,
        ErrorSeverity.MEDIUM,
        "RATE_LIMIT_EXCEEDED",
        context
    );
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandler(logger: SecurityErrorLogger): void {
    process.on("uncaughtException", (error: Error) => {
        const securityError = createSecurityError(
            error.message,
            ErrorType.INTERNAL,
            ErrorSeverity.CRITICAL,
            "UNCAUGHT_EXCEPTION",
            { operation: "global_handler" }
        );
        logger.logError(securityError);
        process.exit(1);
    });

    process.on("unhandledRejection", (reason: any) => {
        const securityError = createSecurityError(
            `Unhandled promise rejection: ${reason}`,
            ErrorType.INTERNAL,
            ErrorSeverity.CRITICAL,
            "UNHANDLED_REJECTION",
            { operation: "global_handler" }
        );
        logger.logError(securityError);
    });
}


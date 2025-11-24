# XyPriss Security Guide

XyPriss includes 12 built-in security middleware modules to protect your applications from common web vulnerabilities without requiring Express.

## Built-in Security Middleware

XyPriss provides the following security middleware out of the box:

1. **Helmet** - Security headers (CSP, X-Frame-Options, HSTS, etc.)
2. **CORS** - Cross-origin resource sharing protection
3. **Rate Limiting** - Request throttling and abuse prevention
4. **CSRF** - Cross-site request forgery protection using csrf-csrf
5. **Compression** - Response compression with security considerations
6. **HPP** - HTTP parameter pollution protection
7. **Mongo Sanitize** - NoSQL injection protection
8. **XSS** - Cross-site scripting protection
9. **Morgan** - Request logging for security monitoring
10. **Slow Down** - Progressive delay protection against abuse
11. **Express Brute** - Brute force attack protection
12. **Validator** - Input validation and sanitization helpers

### CSRF Protection

XyPriss uses the `csrf-csrf` library for robust CSRF protection:

```typescript
import { createServer } from "xypriss";

const app = createServer();

// CSRF protection is enabled by default
// Access middleware API to configure
app.middleware().csrf({
    getSecret: () => process.env.CSRF_SECRET || "default-secret",
    cookieName: "__Host-csrf-token",
    cookieOptions: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
    },
});
```

### Security Headers (Helmet)

Comprehensive security headers protection:

```typescript
app.middleware().helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
});
```

### Rate Limiting and Abuse Prevention

Multiple layers of protection against abuse:

```typescript
// Basic rate limiting
app.middleware().rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP",
});

// Progressive slow down
app.middleware().slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 10, // Allow 10 requests without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 5000, // Maximum delay of 5 seconds
});
```

### Input Validation and Sanitization

Protection against injection attacks:

```typescript
// XSS protection
app.middleware().xss({
    whiteList: {
        a: ["href"],
        b: [],
        i: [],
        strong: [],
        em: [],
    },
});

// MongoDB injection protection
app.middleware().mongoSanitize({
    replaceWith: "_",
});

// HTTP parameter pollution protection
app.middleware().hpp({
    whitelist: ["tags", "categories"], // Allow arrays for these parameters
});
```

## Security Configuration

### Basic Security Setup

```typescript
import { createServer } from "xypriss";

const server = createServer({
    // Security is enabled by default
    server: {
        port: 3000,
    },
});
```

### Custom Security Configuration

```typescript
const server = createServer({
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        },
        cors: {
            origin: [
                "https://docs.xypriss.nehonix.com",
                "https://app.yourdomain.com",
            ],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE"],
        },
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: "Too many requests from this IP",
        },
    },
});
```

## XyPriss Security Module Integration

### Installation

```bash
npm install xypriss-security
```

### Basic Integration

```typescript
import { createServer } from "xypriss";
import {
    XyPrissSecurity,
    fString,
    fArray,
    fObject,
    generateSecureToken,
} from "xypriss-security";

const server = createServer();

// Secure route example
server.post("/api/secure-data", async (req, res) => {
    try {
        // Use secure data structures
        const secureData = fArray(req.body.items);
        const secureMessage = fString(req.body.message, {
            protectionLevel: "maximum",
            enableEncryption: true,
        });

        // Generate secure token
        const token = generateSecureToken({
            length: 32,
            entropy: "maximum",
        });

        res.json({
            success: true,
            token,
            itemCount: secureData.length,
        });
    } catch (error) {
        res.status(500).json({ error: "Security operation failed" });
    }
});
```

## Authentication and Authorization

### JWT Authentication Example

```typescript
import jwt from "jsonwebtoken";
import { Hash } from "xypriss-security";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Login endpoint
server.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res
            .status(400)
            .json({ error: "Username and password required" });
    }

    // Hash password for comparison (use proper password hashing in production)
    const hashedPassword = Hash.create(password, { algorithm: "sha256" });

    // Verify user (implement your user verification logic)
    const user = await verifyUser(username, hashedPassword);

    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    res.json({ token, user: { id: user.id, username: user.username } });
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token" });
        }
        req.user = user;
        next();
    });
}

// Protected route
server.get("/api/protected", authenticateToken, (req, res) => {
    res.json({ message: "This is protected data", user: req.user });
});
```

## Password Security

### Secure Password Hashing

```typescript
import { Password } from "xypriss-security";

// Hash password during registration
server.post("/auth/register", async (req, res) => {
    const { username, password } = req.body;

    // Validate password strength
    const strength = Password.checkStrength(password);
    if (strength.score < 3) {
        return res.status(400).json({
            error: "Password too weak",
            feedback: strength.feedback,
        });
    }

    // Hash password with Argon2ID
    const hashedPassword = await Password.hash(password, {
        algorithm: "argon2id",
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });

    // Save user (implement your user storage logic)
    const user = await createUser(username, hashedPassword);

    res.json({ message: "User created successfully", userId: user.id });
});

// Verify password during login
server.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;

    // Get user from database
    const user = await getUserByUsername(username);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValid = await Password.verify(password, user.hashedPassword);
    if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate session token
    const token = generateSecureToken({
        length: 32,
        entropy: "maximum",
    });

    res.json({ token, user: { id: user.id, username: user.username } });
});
```

## Data Encryption

### Encrypting Sensitive Data

```typescript
import { XyPrissSecurity, fObject } from "xypriss-security";

// Store encrypted user data
server.post("/api/user-data", authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const sensitiveData = req.body;

    // Create secure object for sensitive data
    const secureUserData = fObject(sensitiveData, {
        enableEncryption: true,
        encryptionKey: process.env.DATA_ENCRYPTION_KEY,
    });

    // Store in database (the data will be encrypted)
    await saveUserData(userId, secureUserData.serialize());

    res.json({ message: "Data saved securely" });
});

// Retrieve and decrypt user data
server.get("/api/user-data", authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    // Retrieve encrypted data from database
    const encryptedData = await getUserData(userId);

    // Decrypt data
    const secureUserData = fObject.deserialize(encryptedData, {
        encryptionKey: process.env.DATA_ENCRYPTION_KEY,
    });

    res.json(secureUserData.toPlainObject());
});
```

## Input Validation and Sanitization

### Request Validation

```typescript
import { Validators } from "xypriss-security";

// Validation middleware
function validateInput(rules) {
    return (req, res, next) => {
        const validation = Validators.validate(req.body, rules);

        if (!validation.isValid) {
            return res.status(400).json({
                error: "Validation failed",
                details: validation.errors,
            });
        }

        // Use sanitized values
        req.body = validation.sanitizedValue;
        next();
    };
}

// Use validation middleware
server.post(
    "/api/users",
    validateInput({
        username: {
            type: "string",
            required: true,
            minLength: 3,
            maxLength: 50,
            pattern: /^[a-zA-Z0-9_]+$/,
            sanitize: true,
        },
        email: {
            type: "email",
            required: true,
            sanitize: true,
        },
        age: {
            type: "number",
            min: 13,
            max: 120,
        },
    }),
    (req, res) => {
        // req.body now contains validated and sanitized data
        res.json({ message: "User data is valid" });
    }
);
```

## Security Middleware

### Custom Security Middleware

```typescript
// Rate limiting per user
function userRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const userRequests = new Map();

    return (req, res, next) => {
        const userId = req.user?.userId;
        if (!userId) return next();

        const now = Date.now();
        const userKey = `user:${userId}`;

        if (!userRequests.has(userKey)) {
            userRequests.set(userKey, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const userData = userRequests.get(userKey);

        if (now > userData.resetTime) {
            userData.count = 1;
            userData.resetTime = now + windowMs;
            return next();
        }

        if (userData.count >= maxRequests) {
            return res.status(429).json({ error: "Rate limit exceeded" });
        }

        userData.count++;
        next();
    };
}

// Apply user-specific rate limiting
server.use("/api", authenticateToken, userRateLimit(50, 60000));
```

## Security Headers

### Custom Security Headers

```typescript
// Security headers middleware
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");

    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Enable XSS protection
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // Strict transport security
    res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
    );

    // Content security policy
    res.setHeader("Content-Security-Policy", "default-src 'self'");

    // Referrer policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    next();
}

server.use(securityHeaders);
```

## Audit Logging

### Security Event Logging

```typescript
import { TamperEvidentLogger } from "xypriss-security";

const auditLogger = new TamperEvidentLogger({
    secretKey: process.env.AUDIT_SECRET_KEY,
    logFile: "security-audit.log",
});

// Log security events
async function logSecurityEvent(event, details) {
    await auditLogger.log("security", event, {
        timestamp: new Date().toISOString(),
        ...details,
    });
}

// Login attempt logging
server.post("/auth/login", async (req, res) => {
    const { username } = req.body;
    const clientIP = req.ip;

    try {
        // ... authentication logic ...

        await logSecurityEvent("login_success", {
            username,
            clientIP,
            userAgent: req.get("User-Agent"),
        });

        res.json({ token });
    } catch (error) {
        await logSecurityEvent("login_failure", {
            username,
            clientIP,
            error: error.message,
            userAgent: req.get("User-Agent"),
        });

        res.status(401).json({ error: "Authentication failed" });
    }
});
```

## Security Best Practices

### 1. Environment Variables

```bash
# Use strong, unique secrets
JWT_SECRET=your-very-long-random-secret-key
DATA_ENCRYPTION_KEY=another-long-random-key
AUDIT_SECRET_KEY=audit-specific-secret-key

# Database credentials
DB_PASSWORD=secure-database-password

# API keys
EXTERNAL_API_KEY=your-external-api-key
```

### 2. HTTPS Configuration

```typescript
import https from "https";
import fs from "fs";

const server = createServer();

// HTTPS server
const httpsServer = https.createServer(
    {
        key: fs.readFileSync("path/to/private-key.pem"),
        cert: fs.readFileSync("path/to/certificate.pem"),
    },
    server
);

httpsServer.listen(443, () => {
    console.log("HTTPS server running on port 443");
});

// Redirect HTTP to HTTPS
const httpServer = createServer();
httpServer.use((req, res) => {
    res.redirect(301, `https://${req.headers.host}${req.url}`);
});
httpServer.listen(80);
```

### 3. Error Handling

```typescript
// Secure error handling
server.use((err, req, res, next) => {
    // Log error securely
    console.error("Error:", err.message);

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === "development";

    res.status(err.status || 500).json({
        error: isDevelopment ? err.message : "Internal server error",
        stack: isDevelopment ? err.stack : undefined,
    });
});
```

### 4. Security Monitoring

```typescript
// Monitor suspicious activity
function securityMonitoring(req, res, next) {
    const suspiciousPatterns = [
        /\.\.\//, // Directory traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
    ];

    const requestData = JSON.stringify(req.body) + req.url;

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestData)) {
            logSecurityEvent("suspicious_request", {
                pattern: pattern.toString(),
                url: req.url,
                body: req.body,
                clientIP: req.ip,
            });

            return res.status(400).json({ error: "Invalid request" });
        }
    }

    next();
}

server.use(securityMonitoring);
```

## Security Checklist

-   [ ] Use HTTPS in production
-   [ ] Implement proper authentication
-   [ ] Hash passwords with strong algorithms (Argon2ID)
-   [ ] Validate and sanitize all inputs
-   [ ] Use security headers (Helmet)
-   [ ] Implement rate limiting
-   [ ] Log security events
-   [ ] Keep dependencies updated
-   [ ] Use environment variables for secrets
-   [ ] Implement proper error handling
-   [ ] Monitor for suspicious activity
-   [ ] Regular security audits
-   [ ] Use XyPriss Security module for sensitive operations

Following these security practices will help ensure your XyPriss applications are secure and resilient against common attacks. Send your message via email "xypriss-support@nehonix.com"


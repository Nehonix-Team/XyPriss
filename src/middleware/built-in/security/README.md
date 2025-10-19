# XyPriss Built-in Security Modules

Comprehensive security protection modules with intelligent false positive avoidance.

## Available Modules

### 1. **SQLInjectionDetector**
Detects and prevents SQL injection attacks with contextual analysis.

**Features:**
- High-risk pattern detection (union attacks, boolean injections, time-based attacks)
- Medium-risk pattern detection with context awareness
- False positive mitigation through legitimacy scoring
- Smart sanitization that preserves legitimate content
- Configurable risk thresholds

**Usage:**
```typescript
import { SQLInjectionDetector } from './built-in/security';

const detector = new SQLInjectionDetector({
    strictMode: false,
    contextualAnalysis: true,
    falsePositiveThreshold: 0.6,
});

const result = detector.detect(userInput, 'search');
if (result.isMalicious) {
    // Block or sanitize
}
```

### 2. **PathTraversalDetector**
Prevents directory traversal attacks while allowing legitimate file paths.

**Features:**
- Detects classic traversal patterns (../, encoded variants)
- URL and double-URL encoding detection
- Null byte injection detection
- Configurable allowed paths and extensions
- Path depth validation

**Usage:**
```typescript
import { PathTraversalDetector } from './built-in/security';

const detector = new PathTraversalDetector({
    allowedPaths: ['/uploads/', '/public/'],
    allowedExtensions: ['.jpg', '.png', '.pdf'],
    maxDepth: 3,
});

const result = detector.detect(filePath);
```

### 3. **CommandInjectionDetector**
Detects OS command injection attempts with context awareness.

**Features:**
- Command chaining detection (;, |, &, `)
- Command substitution detection ($(), ``)
- Dangerous command detection
- Context-aware analysis for technical fields
- Network command detection

**Usage:**
```typescript
import { CommandInjectionDetector } from './built-in/security';

const detector = new CommandInjectionDetector({
    contextualAnalysis: true,
});

const result = detector.detect(userInput, {
    fieldName: 'description',
    fieldType: 'text',
});
```

### 4. **XXEProtector**
Prevents XML External Entity (XXE) attacks.

**Features:**
- External entity detection
- DTD declaration detection
- File protocol detection
- Safe XML parsing helper
- Configurable DTD/entity policies

**Usage:**
```typescript
import { XXEProtector } from './built-in/security';

const protector = new XXEProtector({
    allowDTD: false,
    allowExternalEntities: false,
});

const result = protector.detect(xmlContent);
const safeData = protector.safeParseXML(xmlContent);
```

### 5. **LDAPInjectionDetector**
Detects LDAP injection attempts.

**Features:**
- LDAP metacharacter detection
- Filter injection detection
- DN injection detection
- Proper LDAP escaping

**Usage:**
```typescript
import { LDAPInjectionDetector } from './built-in/security';

const detector = new LDAPInjectionDetector();
const result = detector.detect(ldapInput);
```

## Input Validation

For input validation, we recommend using established validation libraries based on your needs:

- **[validator.js](https://github.com/validatorjs/validator.js)** - String validation and sanitization
- **[joi](https://github.com/sideway/joi)** - Schema-based validation
- **[zod](https://github.com/colinhacks/zod)** - TypeScript-first schema validation
- **[yup](https://github.com/jquense/yup)** - Schema validation with async support
- **[ajv](https://github.com/ajv-validator/ajv)** - JSON Schema validator

These libraries are battle-tested and provide comprehensive validation features that would be redundant to reimplement.

## Already Implemented in XyPriss

The following security features are already implemented in the main security middleware:

- **XSS Protection** - Using `xss` library in `security-middleware.ts`
- **CSRF Protection** - Using `csrf-csrf` library in `BuiltInMiddleware.ts`
- **CORS** - Using `cors` library
- **Helmet** - Using `helmet` library for security headers
- **Rate Limiting** - Using `express-rate-limit`
- **Compression** - Using `compression` library
- **HPP** - Using `hpp` library
- **MongoDB Sanitization** - Using `express-mongo-sanitize`

## Configuration

All modules support a common configuration interface:

```typescript
interface SecurityModuleConfig {
    enabled?: boolean;
    strictMode?: boolean;
    logAttempts?: boolean;
    blockOnDetection?: boolean;
    falsePositiveThreshold?: number;
    customPatterns?: RegExp[];
}
```

## Detection Result

All modules return a consistent result format:

```typescript
interface SecurityDetectionResult {
    isMalicious: boolean;
    confidence: number;
    detectedPatterns: string[];
    sanitizedInput?: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    metadata?: Record<string, any>;
}
```

## Best Practices

1. **Use contextual analysis** - Provide context information to reduce false positives
2. **Configure thresholds** - Adjust `falsePositiveThreshold` based on your use case
3. **Log attempts** - Enable logging to monitor attack patterns
4. **Sanitize, don't just block** - Use sanitized input when possible
5. **Combine modules** - Use multiple detectors for defense in depth

## Integration with Security Middleware

These modules are used internally by the security middleware but can also be used standalone for custom validation logic.

## Future Enhancements

- Integration with external threat intelligence
- Machine learning-based detection
- Real-time attack pattern updates
- Performance optimizations for high-traffic scenarios

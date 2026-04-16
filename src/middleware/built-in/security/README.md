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
import { SQLInjectionDetector } from "./built-in/security";

const detector = new SQLInjectionDetector({
    strictMode: false,
    contextualAnalysis: true,
    falsePositiveThreshold: 0.6,
});

const result = detector.detect(userInput, "search");
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
import { PathTraversalDetector } from "./built-in/security";

const detector = new PathTraversalDetector({
    allowedPaths: ["/uploads/", "/public/"],
    allowedExtensions: [".jpg", ".png", ".pdf"],
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
import { CommandInjectionDetector } from "./built-in/security";

const detector = new CommandInjectionDetector({
    contextualAnalysis: true,
});

const result = detector.detect(userInput, {
    fieldName: "description",
    fieldType: "text",
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
import { XXEProtector } from "./built-in/security";

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
import { LDAPInjectionDetector } from "./built-in/security";

const detector = new LDAPInjectionDetector();
const result = detector.detect(ldapInput);
```

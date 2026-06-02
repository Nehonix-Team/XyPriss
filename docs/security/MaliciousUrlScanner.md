# Malicious URL Scanner

The **Malicious URL Scanner** is an advanced security component built into XyPriss, powered by the `StruLink` analysis engine. It acts as a Web Application Firewall (WAF) at the URL level, scanning all incoming requests to detect malicious patterns before they even reach your controllers or routers.

This module specifically protects against attack vectors such as:
- Cross-Site Scripting (XSS) via the URL
- Path Traversal (`../..`)
- SQL and NoSQL injections in query parameters
- Command Injections
- Template Injections (SSTI)

## Configuration in `ServerOptions`

The scanner can be fully configured via the `security.maliciousUrlScanner` property when creating your XyPriss server.

### Quick Setup

To enable the scanner with default settings (which will actively block malicious URLs):

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        maliciousUrlScanner: true,
    }
});
```

### Disabling the Scanner

To completely disable the scanner (not recommended in production):

```typescript
const app = createServer({
    security: {
        maliciousUrlScanner: false,
    }
});
```

Or explicitly via the configuration object:

```typescript
const app = createServer({
    security: {
        maliciousUrlScanner: {
            enabled: false
        }
    }
});
```

## Operating Modes (`mode`)

The scanner supports two operating modes, defined by the `mode` property:

1. **`"block"` (Default)**: Immediately blocks the request if a malicious pattern is detected. Returns a `403 Forbidden` HTTP response with the internal error code `EMALICIOUSURL`.
2. **`"log"`**: Allows the request to pass and be processed by the application, but generates a security alert via the XyPriss logger (`logger.warn`). Ideal for an audit period to identify potential false positives before switching to blocking mode.

```typescript
const app = createServer({
    security: {
        maliciousUrlScanner: {
            enabled: true,
            mode: "log", // Switches to observation mode
        }
    }
});
```

## Advanced StruLink Configuration (`options`)

You can finely control the analysis behavior by passing `options` directly to the `StruLink` engine.

```typescript
import { MaliciousPatternType } from "strulink";

const app = createServer({
    security: {
        maliciousUrlScanner: {
            enabled: true,
            mode: "block",
            options: {
                // Defines the minimum score for a URL to be considered malicious
                minScore: 40,
                
                // Adjusts the overall analysis sensitivity (1.0 = normal, >1.0 = more sensitive)
                sensitivity: 1.0,
                
                // Restricts the analysis to specific attack types
                enabledPatternTypes: [
                    MaliciousPatternType.XSS,
                    MaliciousPatternType.PATH_TRAVERSAL,
                    MaliciousPatternType.COMMAND_INJECTION,
                    MaliciousPatternType.SQL_INJECTION
                ],
                
                // Advanced detection configurations
                advanced: {
                    maxEncodingLayers: 3, // Blocks after 3 layers of encoding (e.g., %252F)
                    entropyThreshold: 4.8 // Entropy threshold to detect obfuscation
                }
            }
        }
    }
});
```

### Engine Default Values

If no specific options are provided, the scanner applies the following strict settings:
- `minScore`: 40
- `sensitivity`: 1.0
- `advanced.maxEncodingLayers`: 3
- `advanced.entropyThreshold`: 4.8

## Error Behavior (`Fail-Open`)

In the exceptional case where the `StruLink` analysis engine encounters an unexpected error while processing a URL, the scanner will adopt a **Fail-Open** behavior. This means the error will be logged (`logger.error`), but the request will be allowed to continue. This design choice prevents a parsing error from bringing down the entire application.

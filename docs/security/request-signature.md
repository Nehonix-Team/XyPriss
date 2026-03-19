# Request Signature Protection

The XyPriss Request Signature Protection system ensures that incoming requests are authentic and have not been tampered with. It uses an HMAC (Hash-based Message Authentication Code) to verify the integrity and origin of requests.

## Overview

When enabled, the server validates a cryptographic signature provided in a specific HTTP header. This signature must match a hash generated locally using a shared secret and the request's payload/metadata.

## Configuration

The feature is configured within the `security.requestSignature` block of the server configuration.

| Property                   | Type      | Description                                                                                |
| :------------------------- | :-------- | :----------------------------------------------------------------------------------------- |
| `headerName`               | `string`  | The name of the HTTP header containing the signature. Default: `XP-Request-Sig`.           |
| `secret`                   | `string`  | The shared secret used for HMAC generation. Must be at least 32 characters for production. |
| `errorMessage`             | `string`  | Custom error message returned when validation fails.                                       |
| `statusCode`               | `number`  | HTTP status code returned on validation failure. Default: `403`.                           |
| `timingSafeComparison`     | `boolean` | Enables protection against timing attacks during signature verification.                   |
| `rejectSuspiciousPatterns` | `boolean` | Enables additional heuristic checks for common attack patterns in signatures.              |

### Configuration Example

```typescript
import { createServer, __sys__ } from "xypriss";

const app = createServer({
    security: {
        requestSignature: {
            headerName: "X-Hub-Signature-256",
            // Use XyPriss native environment access instead of process.env
            secret:
                __sys__.$env("SIG_SECRET") ||
                "your-32-character-minimum-secret-here", // or __sys__.__env__.get("SIG_SECRET", "your-32-character-minimum-secret-here");
            errorMessage: "Invalid or missing request signature.",
            statusCode: 401,
            timingSafeComparison: true,
        },
    },
});
```

## Security Best Practices

1. **Secret Length**: Use a cryptographically strong secret. XyPriss enforces a minimum length of 32 characters in production environments.
2. **Timing Attacks**: Always keep `timingSafeComparison` enabled to prevent attackers from guessing signatures by measuring response times.
3. **Environment Management**: Use `__sys__.$env()` to access environment variables. Avoid direct access to `process.env` to maintain compatibility with the XyPriss security model.
4. **Custom Headers**: Changing the default header name (`XP-Request-Sig`) can provide a minor security-through-obscurity benefit.

## Client-Side Signature Generation

To communicate with a protected server, the client must generate an HMAC-SHA256 signature and include it in the configured header.

### TypeScript / Node.js Example

```typescript
import { Hash, XStringify } from "xypriss-security";

// 1. Define the shared secret (must match the server's secret)
const secret = "your-shared-secret";

// 2. Prepare the payload using XStringify
// XStringify is a high-performance alternative to JSON.stringify
// that efficiently handles large objects and circular references.
const payload = XStringify({ data: "example" });

// 3. Generate the HMAC-SHA256 signature
// Hash.hmac provides a secure, timing-safe way to sign the payload.
const signature = Hash.hmac(secret, payload, "sha256");

console.log("Generated signature:", signature);

// 4. Include signature in the request headers
fetch("https://api.example.com/data", {
    method: "POST",
    body: payload,
    headers: {
        "X-Hub-Signature-256": signature,
        "Content-Type": "application/json",
    },
});
```

## Troubleshooting

### Shared Secret Mismatch

The most common cause of validation failure is a mismatch between the secret on the server and the secret used by the client. Ensure both are identical and that no whitespace or newline characters were accidentally copied.

### Header Name Case Sensitivity

While XyPriss's underlying engine handles headers in a case-insensitive manner, ensure the `headerName` in your configuration exactly matches the one you intend to use in your client requests.

### Signature Format

Ensure the client generates a **Hex** encoded HMAC-SHA256 signature. `Hash.hmac` returns a hex string by default.


# Environment Setup for XyPriss Security Module

The XyPriss Security Module requires proper environment configuration for production use to ensure maximum security.

## Required Environment Variables

### Option 1: Direct Encryption Key
```bash
# Set a 64-character hexadecimal encryption key
export ENC_SECRET_KEY="abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
```

### Option 2: Seed and Salt (Alternative)
```bash
# Set seed and salt for key derivation
export ENC_SECRET_SEED="your-secure-seed-value-here"
export ENC_SECRET_SALT="your-secure-salt-value-here"
```

## Development Setup

For development and testing, you can create a `.env` file:

```bash
# .env file
ENC_SECRET_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
ENC_SECRET_SEED=development-seed-value
ENC_SECRET_SALT=development-salt-value
```

## Security Warnings

If environment variables are not set, you'll see this warning:
```
[SECURITY] UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY or (ENC_SECRET_SEED and ENC_SECRET_SALT)
```

This is expected in development but should be resolved in production.

## Integrity Check Failures

The security module includes integrity checks that may fail if:
- Data has been tampered with
- Encryption keys have changed
- Memory corruption is detected

This is normal security behavior and indicates the module is working correctly.

## Testing with Environment Variables

```typescript
// Set environment variables before importing
process.env.ENC_SECRET_KEY = "your-key-here";
process.env.ENC_SECRET_SEED = "your-seed-here";
process.env.ENC_SECRET_SALT = "your-salt-here";

import { fObject } from "xypriss-security";

// Use with proper error handling
try {
    const secureData = fObject({ sensitive: "data" });
    // ... use secureData
} catch (error) {
    if (error.message.includes("integrity check failed")) {
        console.log("Security module detected potential tampering");
    }
}
```

## Production Recommendations

1. **Use strong, random keys**: Generate cryptographically secure keys
2. **Store keys securely**: Use environment variables, not code
3. **Rotate keys regularly**: Implement key rotation policies
4. **Monitor integrity failures**: Log and investigate integrity check failures
5. **Use proper key management**: Consider using key management services

## Key Generation

Generate secure keys using:

```bash
# Generate a 64-character hex key
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

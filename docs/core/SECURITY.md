# XyPriss Security: Honeypot Tarpit

## Overview

The **Honeypot Tarpit** is a high-performance security layer designed to instantly identify and neutralize malicious bots, vulnerability scanners, and automated exploit frameworks. 

Unlike traditional security middleware that might perform expensive regex matching or database lookups, the Honeypot Tarpit operates at the very edge of the request lifecycle using ultra-fast, constant-time `Set` lookups.

---

## How it Works

When a request enters XyPriss, the URI is normalized (decoding encodings and resolving path traversals). Before any routing or business logic is executed, the path is checked against thousands of known malicious signatures.

### Detection Layers
1.  **Exact Paths**: Matches common targets like `/.env`, `/wp-login.php`, or `/config.json`.
2.  **Directory Prefixes**: Blocks entire sensitive subtrees like `/.git/`, `/.ssh/`, or `/actuator/`.
3.  **File Extensions**: Identifies dangerous file types that should never be public, such as `.pem`, `.key`, or `.sql`.
4.  **Path Segments**: Catches malicious markers anywhere in the URL (e.g., `/api/v1/phpmyadmin/setup`).

---

## Configuration

The Honeypot Tarpit is **enabled by default**. You can customize or extend its behavior via `ServerOptions`.

### 1. Basic Toggle
```typescript
const app = createServer({
    security: {
        honeypotTarpit: true // Default
    }
});
```

### 2. Custom Trap Signatures
You can extend the built-in database with application-specific patterns that you want to protect.

```typescript
const app = createServer({
    security: {
        honeypotTarpit: {
            enabled: true,
            // Trap specific files
            exact: ["/my-internal-api-doc.pdf", "/debug-log.txt"],
            
            // Trap entire directory patterns
            prefixes: ["/internal-tools/", "/legacy-admin/"],
            
            // Trap specific segments anywhere in the URL
            segments: ["test-credentials", "root-access"]
        }
    }
});
```

---

## Behavior under Attack

When a trap is triggered:
1.  **Connection Termination**: XyPriss immediately sends a bare `403 Forbidden` response.
2.  **Zero Overhead**: No body is sent, no extra headers are added, and no further middleware or route handlers are executed.
3.  **Logging**: A security warning is logged with the blocked path and requester info.

---

## Best Practices

*   **Leave it Enabled**: The false-positive rate is practically zero because the traps target files that do not exist in legitimate modern applications.
*   **Extend for Private Files**: If your application has specific sensitive files that are not part of the standard `dotfiles` list (e.g., `credentials.json` at the root), add them to the `exact` traps.
*   **Monitor Logs**: Frequent honeypot triggers are a sign of automated scanning; you can use these logs to feed your external firewall or WAF.

---

## Summary

The Honeypot Tarpit provides a "Zero-Trust" entrance to your application, ensuring that bots and scanners are neutralized before they can even attempt to probe your business logic or consume system resources.

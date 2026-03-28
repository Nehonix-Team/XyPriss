# Real Client IP Resolution (getIp)

The `getIp` utility is a highly robust API designed to accurately identify the real client IP address, even when the request passes through multiple layers of proxies, load balancers, and VPNs (e.g., Cloudflare, Akamai, Nginx).

## 1. Resolution Order

To ensure maximum accuracy, `getIp` resolves the IP address by checking headers in a specific order of trustworthiness:

1.  **`CF-Connecting-IP`**: Cloudflare's authoritative client IP header.
2.  **`True-Client-IP`**: Used by Akamai and Cloudflare Enterprise.
3.  **`X-Real-IP`**: Standard for single-proxy (Nginx) setups.
4.  **`X-Client-IP`**: Used by various load balancers and Apache `mod_remoteip`.
5.  **`X-Cluster-Client-IP`**: Common in Rackspace and specific Nginx configurations.
6.  **`Forwarded`** (RFC 7239): The standard multi-proxy header.
7.  **`X-Forwarded-For`**: The de-facto standard. `getIp` intelligently selects the first **public** IP from the chain to bypass internal proxy hops.
8.  **`req.ip`**: The framework's internal parsed value (respects `trustProxy` settings).
9.  **`socket.remoteAddress`**: The raw TCP connection address.
10. **`127.0.0.1`**: Safe fallback if no other source is available.

---

## 2. IP Normalization

`getIp` automatically sanitizes and normalizes the resolved IP address:

- Strips port numbers (e.g., `1.2.3.4:8080` → `1.2.3.4`).
- Removes URL brackets from IPv6 (e.g., `[::1]` → `::1`).
- Eliminates IPv6-mapped IPv4 prefixes (e.g., `::ffff:1.2.3.4` → `1.2.3.4`).

---

## 3. Usage Examples

### Basic Usage

The most common use case returns the IP address as a string.

```typescript
import { getIp } from "xypriss";

app.get("/api/whoami", (req, res) => {
    const ip = getIp(req);
    res.json({ yourIp: ip });
});
```

### Observability & Debugging

By passing `true` as the second argument, you can retrieve enriched metadata including the source header that provided the IP.

```typescript
import { getIp } from "xypriss";

app.get("/api/debug-ip", (req, res) => {
    const { ip, source } = getIp(req, true);
    console.log(`Resolved IP ${ip} via ${source}`);
    res.json({ ip, source });
});
```

---

## 4. Security Considerations

- **Public IP Filtering**: When scanning `X-Forwarded-For` or `Forwarded` headers, `getIp` prioritizes public IP ranges over private (RFC 1918) and loopback ranges. This prevents malicious clients from spoofing their IP by injecting a fake internal IP into the headers.
- **Fail-Safe**: The utility is designed never to throw an exception, ensuring application stability even with malformed request objects.

---

[← Back to API Reference](../core/api-reference.md)


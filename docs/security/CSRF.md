# CSRF Protection

XyPriss includes built-in **CSRF (Cross-Site Request Forgery) protection** using the Double-Submit Cookie pattern, powered by the `csrf-csrf` library. It is integrated directly into the security middleware pipeline and is configurable via `ServerOptions`.

## How It Works

The protection is based on the **Double-Submit Cookie** strategy:

1. On the first request, the server generates a cryptographically signed CSRF token and sets it as a cookie (`__Host-csrf-token` by default).
2. For every state-mutating request (`POST`, `PUT`, `PATCH`, `DELETE`), the client must include the token in one of the following locations:
   - `x-csrf-token` HTTP header (recommended for SPAs and API clients)
   - `_csrf` field in the request body
   - `_csrf` query parameter
3. The server validates the submitted token against the signed cookie. If they do not match, the request is rejected with `403 Forbidden`.

`GET`, `HEAD`, and `OPTIONS` requests are ignored by default, as they are considered safe methods.

## Configuration in `ServerOptions`

CSRF protection is configured under `security.csrf`.

> [!IMPORTANT]
> A `secret` is **required** when enabling CSRF protection. It is used to sign tokens. It must be a strong, randomly generated string kept out of source control. Use an environment variable.

### Basic Setup

```typescript
import { createServer } from "xypriss";

const app = createServer({
    security: {
        csrf: {
            secret: process.env.CSRF_SECRET,
        }
    }
});
```

### Using XyPriss Environment Shield (`__sys__`)

The recommended approach is to use the built-in environment shield to securely load the secret:

```typescript
import { createServer, __sys__ } from "xypriss";

const app = createServer({
    security: {
        csrf: {
            secret: __sys__.__env__.get("CSRF_SECRET", "fallback-dev-secret"),
            cookieOptions: {
                httpOnly: true,
                sameSite: "strict",
            }
        }
    }
});
```

### Disabling CSRF Protection

```typescript
const app = createServer({
    security: {
        csrf: false,
    }
});
```

## Configuration Reference (`CSRFConfig`)

| Property | Type | Default | Description |
|---|---|---|---|
| `secret` | `string` | **Required** | Secret key used to sign and verify CSRF tokens. |
| `enabled` | `boolean` | `true` | Toggle CSRF protection. |
| `cookieName` | `string` | `"__Host-csrf-token"` | Name of the CSRF session cookie. |
| `cookieOptions.httpOnly` | `boolean` | `true` | Prevents client-side JavaScript from accessing the session cookie. |
| `cookieOptions.sameSite` | `"strict" \| "lax" \| "none" \| boolean` | `"strict"` | Controls cookie cross-site behavior. |
| `cookieOptions.secure` | `boolean` | `true` in production | Restricts the cookie to HTTPS. Automatically set based on environment. |
| `trustedOrigins` | `(string \| RegExp)[]` | `[]` | Allows cross-origin requests from specific origins (e.g. `["localhost:5500", /127\.0\.0\.1:\d+/]`). |
| `doubleSubmitCookie` | `boolean \| object` | `true` | Enables the Double Submit Cookie pattern (`XSRF-TOKEN` cookie injection). See SPA section below. |

## Reading the CSRF Token (Server-Side)

The CSRF token is attached to the request object and can be read directly from `req.csrfToken()`. Use this to send the token to the client (e.g., in an HTML form or as part of an initial API response).

```typescript
app.get("/csrf-token", (req, res) => {
    const token = req.csrfToken?.();
    res.json({ csrfToken: token });
});
```

## Client-Side Integration

### HTML Forms

Embed the token in a hidden field:

```html
<form method="POST" action="/api/submit">
    <input type="hidden" name="_csrf" value="<%= csrfToken %>" />
    <!-- form fields -->
    <button type="submit">Submit</button>
</form>
```

### Fetch / Axios (SPA)

**With `doubleSubmitCookie` enabled (Default)**
XyPriss automatically exposes the CSRF token via a non-HttpOnly cookie named `XSRF-TOKEN` and a response header `X-CSRF-Token` during any initial request. Most modern HTTP clients (like Axios or Angular's HttpClient) will automatically read this cookie and inject it into the `X-XSRF-TOKEN` header on subsequent requests. You don't need to write any custom logic!

```typescript
import axios from 'axios';

// 1. Initial request establishes session and receives XSRF-TOKEN cookie
await axios.get('http://api.yoursite.com/');

// 2. Axios automatically reads the cookie and sends it in POST
await axios.post('http://api.yoursite.com/data', { name: "example" });
```

**With `doubleSubmitCookie` disabled (Manual Mode)**
If you prefer to manually fetch the token, you can read it from the `X-CSRF-Token` response header of any `GET` request, or from a custom route using `req.csrfToken()`.

```typescript
// 1. Get the token from an initial request's headers
const res = await fetch("/api/");
const csrfToken = res.headers.get("X-CSRF-Token");

// 2. Include in subsequent requests
await fetch("/api/data", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ name: "example" }),
});
```

## Pipeline Position

CSRF middleware runs **last** in the security pipeline, after body parsing and all other protections. This is intentional, as CSRF validation requires the request body and session data to be fully available.

## Error Behavior

If the CSRF token is missing or invalid, the middleware returns `403 Forbidden`. No further request processing occurs.

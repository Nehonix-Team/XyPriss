# Send — Structured HTTP Response Helper

**Module:** `Send`
**File:** `src/utils/Send.ts`
**Framework:** XyPriss
**Author:** NEHONIX
**License:** [Nehonix Open Source License v2.0 (NOSL v2)](https://dll.nehonix.com/licenses/NOSL/v2)

---

## Table of Contents

- [Overview](#overview)
- [Motivation](#motivation)
- [Response Body Contract](#response-body-contract)
- [Status Code Registry](#status-code-registry)
- [Internal Architecture](#internal-architecture)
  - [Status Code Generation (`buildStatusCode`)](#status-code-generation-buildstatuscode)
  - [Core Dispatcher (`dispatch`)](#core-dispatcher-dispatch)
- [Constructor](#constructor)
- [API Reference](#api-reference)
  - [2xx — Success](#2xx--success)
  - [3xx — Redirection](#3xx--redirection)
  - [4xx — Client Errors](#4xx--client-errors)
  - [5xx — Server Errors](#5xx--server-errors)
- [Usage Examples](#usage-examples)
  - [Basic Setup](#basic-setup)
  - [Success Responses](#success-responses)
  - [Client Error Responses](#client-error-responses)
  - [Server Error Responses](#server-error-responses)
  - [Custom Status Code Overrides](#custom-status-code-overrides)
  - [Hiding the Server Name](#hiding-the-server-name)
- [Design Principles](#design-principles)
- [Integration with XyPriss](#integration-with-xypriss)
- [Type Reference](#type-reference)

---

## Overview

`Send` is a structured HTTP response utility class built for the XyPriss framework. It standardises the shape of every JSON response sent from the application layer — whether success or error — by centralising status code resolution, response body construction, and output flushing into a single, strongly-typed API.

Every method of `Send` produces a JSON object conforming to the `IResTemplate` contract. This guarantees that all API consumers, regardless of endpoint or context, receive a predictable, machine-readable response body.

---

## Motivation

Without a unified response layer, large applications tend to accumulate ad-hoc patterns:

```typescript
// Ad-hoc — inconsistent shapes, no contract
res.status(400).json({ error: "Bad input" });
res.status(400).json({ message: "Validation failed", ok: false });
res.status(404).json({ msg: "Not found" });
```

These inconsistencies break API consumers, complicate frontend error handling, and make API documentation unreliable. `Send` eliminates this drift by providing a single, opinionated interface that every handler in the application uses.

---

## Response Body Contract

Every response produced by `Send` conforms to the following structure (`IResTemplate`):

```typescript
{
  success: boolean;          // true for 2xx, false for 3xx/4xx/5xx
  message: string;           // Human-readable description of the outcome
  serverName?: string;       // Name of the originating server (optional, enabled by default)
  data?: unknown;            // Payload for success responses or error context
  details: {
    error: string;           // Short label for the status type (e.g. "Bad Request")
    errorCode: string;       // Compact uppercase code (e.g. "EBADR", "SOK")
    statusCode: number;      // HTTP status code (e.g. 400, 200)
  };
}
```

### Example: 200 OK

```json
{
  "success": true,
  "message": "User fetched successfully.",
  "serverName": "my-api",
  "data": { "id": 1, "name": "Alice" },
  "details": {
    "error": "OK",
    "errorCode": "SOK",
    "statusCode": 200
  }
}
```

### Example: 404 Not Found

```json
{
  "success": false,
  "message": "No user found with id '42'.",
  "serverName": "my-api",
  "details": {
    "error": "Not Found",
    "errorCode": "ENOT",
    "statusCode": 404
  }
}
```

---

## Status Code Registry

`Send` maintains an internal registry (`DEFAULT_CONFIGS`) that maps named status keys to their canonical HTTP integer values. These defaults can be partially or fully overridden at construction time.

| Key                     | HTTP Code | Category         |
|-------------------------|-----------|------------------|
| `OK`                    | 200       | 2xx Success      |
| `CREATED`               | 201       | 2xx Success      |
| `ACCEPTED`              | 202       | 2xx Success      |
| `NO_CONTENT`            | 204       | 2xx Success      |
| `MOVED_PERMANENTLY`     | 301       | 3xx Redirection  |
| `FOUND`                 | 302       | 3xx Redirection  |
| `NOT_MODIFIED`          | 304       | 3xx Redirection  |
| `BAD_REQUEST`           | 400       | 4xx Client Error |
| `UNAUTHORIZED`          | 401       | 4xx Client Error |
| `FORBIDDEN`             | 403       | 4xx Client Error |
| `NOT_FOUND`             | 404       | 4xx Client Error |
| `METHOD_NOT_ALLOWED`    | 405       | 4xx Client Error |
| `NOT_ACCEPTABLE`        | 406       | 4xx Client Error |
| `REQUEST_TIMEOUT`       | 408       | 4xx Client Error |
| `CONFLICT`              | 409       | 4xx Client Error |
| `GONE`                  | 410       | 4xx Client Error |
| `PRECONDITION_FAILED`   | 412       | 4xx Client Error |
| `PAYLOAD_TOO_LARGE`     | 413       | 4xx Client Error |
| `UNSUPPORTED_MEDIA_TYPE`| 415       | 4xx Client Error |
| `EXPECTATION_FAILED`    | 417       | 4xx Client Error |
| `IM_A_TEAPOT`           | 418       | 4xx Client Error |
| `UNPROCESSABLE_ENTITY`  | 422       | 4xx Client Error |
| `LOCKED`                | 423       | 4xx Client Error |
| `TOO_MANY_REQUEST`      | 429       | 4xx Client Error |
| `INTERNAL_SERVER_ERR`   | 500       | 5xx Server Error |
| `NOT_IMPLEMENTED`       | 501       | 5xx Server Error |
| `BAD_GATEWAY`           | 502       | 5xx Server Error |
| `SERVICE_UNAVAILABLE`   | 503       | 5xx Server Error |
| `GATEWAY_TIMEOUT`       | 504       | 5xx Server Error |

---

## Internal Architecture

### Status Code Generation (`buildStatusCode`)

The private helper `buildStatusCode` derives a compact, uppercase, prefixed error code from any `SupportedStatus` key.

**Algorithm:**
1. Determine the prefix: `"S"` for success responses, `"E"` for all others.
2. Strip all underscores from the status key.
3. Take the first four characters and uppercase them.
4. Concatenate: `prefix + truncatedKey`.

**Examples:**

| Input Key              | Success | Output Code |
|------------------------|---------|-------------|
| `"OK"`                 | `true`  | `"SOK"`     |
| `"CREATED"`            | `true`  | `"SCREA"`   |
| `"BAD_REQUEST"`        | `false` | `"EBADR"`   |
| `"NOT_FOUND"`          | `false` | `"ENOT"`    |
| `"INTERNAL_SERVER_ERR"`| `false` | `"EINTE"`   |
| `"TOO_MANY_REQUEST"`   | `false` | `"ETOOM"`   |

These codes are designed to be short, stable identifiers suitable for programmatic error handling, logging pipelines, and monitoring dashboards.

### Core Dispatcher (`dispatch`)

All public methods delegate to the private `dispatch` method. It is responsible for:

1. Resolving the numeric HTTP status code from the internal registry.
2. Constructing the full `IResTemplate` body, conditionally including `serverName` and `data`.
3. Flushing the response via `res.status(statusCode).json(body)`.

The `dispatch` signature is:

```typescript
private dispatch(
  statusKey: SupportedStatus,
  label: string,
  success: boolean,
  message?: string,
  data?: unknown,
): void
```

Special-case methods that produce no body (`noContent`, `notModified`) bypass `dispatch` entirely and call `res.status(...).end()` directly, in strict compliance with RFC 7231.

---

## Constructor

```typescript
new Send(res: XyPrisResponse, configs?: Partial<{
  statusCode: Partial<ISeConfigs>;
  includeServerName: boolean;
}>)
```

| Parameter                   | Type                        | Default    | Description                                                              |
|-----------------------------|-----------------------------|------------|--------------------------------------------------------------------------|
| `res`                       | `XyPrisResponse`            | required   | The active response object for the current request.                      |
| `configs.statusCode`        | `Partial<ISeConfigs>`       | `{}`       | Overrides for specific entries in the default status code registry.      |
| `configs.includeServerName` | `boolean`                   | `true`     | Whether to include the `serverName` field in every response body.        |

The server name is read from `__sys__.vars.__name__` at construction time and remains constant for the lifetime of the instance.

---

## API Reference

### 2xx — Success

#### `send.ok(message?, data?)`

Sends a **200 OK** response. Use for successful GET, PUT, PATCH, or DELETE operations that return a body.

```typescript
send.ok("User fetched successfully.", { id: 1, name: "Alice" });
```

---

#### `send.created(message?, data?)`

Sends a **201 Created** response. Use after successfully persisting a new resource. Consider pairing with a `Location` header pointing to the new resource URI.

```typescript
send.created("User created.", { id: 42 });
```

---

#### `send.accepted(message?, data?)`

Sends a **202 Accepted** response. Use when the request has been received but processing will occur asynchronously (background jobs, email dispatch, report generation).

```typescript
send.accepted("Your export is being processed.", { jobId: "abc-123" });
```

---

#### `send.noContent()`

Sends a **204 No Content** response with no body. RFC 7231 prohibits a body on 204 responses. Use after a successful DELETE or an action that produces no meaningful response.

```typescript
send.noContent();
```

---

### 3xx — Redirection

#### `send.movedPermanently(message?, data?)`

Sends a **301 Moved Permanently** response. Clients and search engines should update their references to the new URI.

```typescript
send.movedPermanently("This endpoint has moved.", { location: "/v2/users" });
```

---

#### `send.found(message?, data?)`

Sends a **302 Found** response for temporary redirects. The client should continue using the original URI for future requests.

```typescript
send.found("Redirecting to login.", { location: "/auth/login" });
```

---

#### `send.notModified()`

Sends a **304 Not Modified** response with no body. Use with conditional requests (`If-None-Match`, `If-Modified-Since`) to signal that the client's cached version is still valid.

```typescript
send.notModified();
```

---

### 4xx — Client Errors

#### `send.badRequest(message?, data?)`

Sends a **400 Bad Request** response. Use for malformed requests, missing required fields, invalid formats, or constraint violations.

```typescript
send.badRequest("The 'email' field is required.");
send.badRequest("Validation failed.", { fields: { email: "Invalid format" } });
```

---

#### `send.unauthorized(message?, data?)`

Sends a **401 Unauthorized** response. Use when the request lacks valid authentication credentials. This is an authentication failure, not an authorisation failure.

```typescript
send.unauthorized("Authentication token is missing or expired.");
```

---

#### `send.forbidden(message?, data?)`

Sends a **403 Forbidden** response. Use when the client is authenticated but lacks the necessary permissions. Unlike 401, re-authenticating will not resolve the issue.

```typescript
send.forbidden("You do not have permission to delete this resource.");
send.forbidden("Admin role required.", { requiredRole: "admin" });
```

---

#### `send.notFound(message?, data?)`

Sends a **404 Not Found** response. Use when the requested resource does not exist or has been permanently removed without leaving a forwarding address.

```typescript
send.notFound("No user found with id '42'.");
send.notFound("Resource not found.", { id: "42" });
```

---

#### `send.methodNotAllowed(message?, data?)`

Sends a **405 Method Not Allowed** response. Always pair with an `Allow` header listing the methods the endpoint does support.

```typescript
send.methodNotAllowed("Only GET and POST are allowed on this route.");
send.methodNotAllowed("Method not allowed.", { allowedMethods: ["GET", "POST"] });
```

---

#### `send.notAcceptable(message?, data?)`

Sends a **406 Not Acceptable** response. Use when the server cannot produce a response matching the client's `Accept` header.

```typescript
send.notAcceptable("This API only serves application/json.");
```

---

#### `send.requestTimeout(message?, data?)`

Sends a **408 Request Timeout** response. Use when the server times out waiting for the client to complete the request within the allowed time window.

```typescript
send.requestTimeout("The request took too long. Please try again.");
```

---

#### `send.conflict(message?, data?)`

Sends a **409 Conflict** response. Use when the request conflicts with the current state of the server (duplicate entry, optimistic-lock violation, concurrent edit clash).

```typescript
send.conflict("A user with this email already exists.");
send.conflict("Edit conflict detected.", { existingVersion: 3, yourVersion: 2 });
```

---

#### `send.gone(message?, data?)`

Sends a **410 Gone** response. Use when a resource has been permanently deleted and will not return. Prefer 404 when you do not wish to reveal whether the resource ever existed.

```typescript
send.gone("This account has been permanently deleted.");
```

---

#### `send.preconditionFailed(message?, data?)`

Sends a **412 Precondition Failed** response. Use when a conditional request header (`If-Match`, `If-Unmodified-Since`) evaluates to false on the server.

```typescript
send.preconditionFailed("ETag mismatch — resource was modified since your last fetch.");
```

---

#### `send.payloadTooLarge(message?, data?)`

Sends a **413 Payload Too Large** response. Use when the request body exceeds the server's or route's configured size limit.

```typescript
send.payloadTooLarge("File exceeds the 10 MB limit.");
send.payloadTooLarge("Request body too large.", { maxBytes: 10_485_760 });
```

---

#### `send.unsupportedMediaType(message?, data?)`

Sends a **415 Unsupported Media Type** response. Use when the `Content-Type` or encoding sent by the client is not accepted by the endpoint.

```typescript
send.unsupportedMediaType("Only application/json payloads are accepted.");
```

---

#### `send.expectationFailed(message?, data?)`

Sends a **417 Expectation Failed** response. Use when the `Expect` request-header field could not be satisfied by the server.

```typescript
send.expectationFailed("The 'Expect: 100-continue' header could not be satisfied.");
```

---

#### `send.imATeapot(message?, data?)`

Sends a **418 I'm a Teapot** response (RFC 2324). Occasionally used as a deliberate catch-all for intentionally refused requests such as bot detection.

```typescript
send.imATeapot("I refuse to brew coffee because I am, permanently, a teapot.");
```

---

#### `send.unprocessableEntity(message?, data?)`

Sends a **422 Unprocessable Entity** response. Use when the request is syntactically valid but contains semantic errors that prevent processing (domain validation failures, business rule violations). Preferred over 400 for schema-valid but logically invalid payloads.

```typescript
send.unprocessableEntity("The 'birthDate' must be in the past.");
send.unprocessableEntity("Validation errors.", { fields: { age: "Must be >= 18" } });
```

---

#### `send.locked(message?, data?)`

Sends a **423 Locked** response. Use when the target resource is currently locked (e.g. being edited by another user or under an administrative hold).

```typescript
send.locked("This document is currently being edited by another user.");
send.locked("Resource is locked.", { lockedBy: "alice@example.com", until: "2026-01-01T12:00:00Z" });
```

---

#### `send.tooManyRequest(message?, data?)`

Sends a **429 Too Many Requests** response. Use when the client has exceeded a rate limit or quota. Consider pairing with a `Retry-After` header at the middleware level.

```typescript
send.tooManyRequest("Rate limit reached. Try again in 60 seconds.");
send.tooManyRequest("Quota exceeded.", { retryAfter: 60 });
```

---

### 5xx — Server Errors

#### `send.internalError(message?, data?)`

Sends a **500 Internal Server Error** response. Use for unexpected, unhandled server-side failures. Never expose raw stack traces or internal implementation details in the message.

```typescript
send.internalError("An unexpected error occurred. Please try again later.");
```

---

#### `send.notImplemented(message?, data?)`

Sends a **501 Not Implemented** response. Use when the server does not support the functionality required to fulfil the request (e.g. an HTTP method that is recognised but not yet implemented, or a feature under development).

```typescript
send.notImplemented("The PATCH method is not yet supported on this resource.");
```

---

#### `send.badGateway(message?, data?)`

Sends a **502 Bad Gateway** response. Use when this server, acting as a gateway or proxy, received an invalid response from an upstream service.

```typescript
send.badGateway("The payment provider returned an unexpected response.");
```

---

#### `send.serviceUnavailable(message?, data?)`

Sends a **503 Service Unavailable** response. Use when the server is temporarily unable to handle requests due to maintenance, overload, or a dependency outage. Pair with a `Retry-After` header when the downtime window is known.

```typescript
send.serviceUnavailable("Scheduled maintenance until 06:00 UTC.");
send.serviceUnavailable("Server overloaded.", { retryAfter: "2026-06-01T06:00:00Z" });
```

---

#### `send.gatewayTimeout(message?, data?)`

Sends a **504 Gateway Timeout** response. Use when this server, acting as a gateway or proxy, did not receive a timely response from an upstream server.

```typescript
send.gatewayTimeout("The database did not respond within the allowed time.");
send.gatewayTimeout("Upstream timeout.", { service: "payments-api", timeoutMs: 5000 });
```

---

## Usage Examples

### Basic Setup

Instantiate `Send` at the beginning of a route handler by passing the active `XyPrisResponse` object.

```typescript
import { Send } from "../utils/Send";

app.get("/users/:id", (req, res) => {
  const send = new Send(res);

  const user = db.users.findById(req.params.id);
  if (!user) {
    return send.notFound(`No user found with id '${req.params.id}'.`);
  }

  send.ok("User fetched successfully.", user);
});
```

---

### Success Responses

```typescript
const send = new Send(res);

// 200 — Return a resource
send.ok("Product retrieved.", product);

// 201 — Confirm resource creation
send.created("Order placed.", { orderId: "ORD-9821" });

// 202 — Acknowledge async processing
send.accepted("Report generation started.", { jobId: "JOB-4412" });

// 204 — Confirm deletion with no body
send.noContent();
```

---

### Client Error Responses

```typescript
const send = new Send(res);

// Validation failure
send.badRequest("The 'quantity' field must be a positive integer.");

// Authentication failure
send.unauthorized("Your session has expired. Please log in again.");

// Authorisation failure
send.forbidden("You do not have access to this organisation's data.");

// Resource not found
send.notFound("Invoice #INV-1042 does not exist.");

// Duplicate resource
send.conflict("An account with this email address is already registered.");

// Semantic validation failure
send.unprocessableEntity("The scheduled date cannot be in the past.", {
  fields: { scheduledAt: "Must be a future date" },
});

// Rate limiting
send.tooManyRequest("You have exceeded the limit of 100 requests per minute.", {
  retryAfter: 30,
});
```

---

### Server Error Responses

```typescript
const send = new Send(res);

try {
  await processPayment(order);
  send.ok("Payment processed.", { transactionId: "TXN-7731" });
} catch (err) {
  // Log err internally — never expose it to the client
  logger.error(err);
  send.internalError("An error occurred while processing the payment. Please try again.");
}
```

---

### Custom Status Code Overrides

The default registry can be partially overridden at instantiation. This is useful when a specific route or service requires non-standard HTTP status assignments.

```typescript
const send = new Send(res, {
  statusCode: {
    NOT_FOUND: 404, // can be changed to a custom code if required by a gateway
    TOO_MANY_REQUEST: 429,
  },
});
```

---

### Hiding the Server Name

By default, every response includes the server's name under the `serverName` field, sourced from `__sys__.vars.__name__`. To omit it (e.g. in public-facing APIs where server identity should not be disclosed):

```typescript
const send = new Send(res, { includeServerName: false });
send.ok("Resource fetched.", payload);
// Response body will not contain the `serverName` field
```

---

## Design Principles

**Single source of truth for response shape.** The `IResTemplate` contract is enforced uniformly across all endpoints. There is no way to send a response through `Send` that deviates from this shape.

**Explicit over implicit.** Each HTTP status code has its own named method. There is no generic `send.status(code, ...)` escape hatch. Developers choose the semantically correct method, which improves readability and discourages misuse.

**No body on no-body statuses.** `noContent()` and `notModified()` bypass the JSON serialiser entirely and call `res.end()` directly, in strict compliance with RFC 7231 §6.3.5 and §4.1.

**Short, stable error codes.** The `errorCode` field (e.g. `EBADR`, `ENOT`, `SOK`) provides a compact, programmatic identifier that is stable across message changes and suitable for use in monitoring dashboards, log parsers, and client-side error handling logic.

**Defence in depth on 5xx messages.** The API documentation for all 5xx methods explicitly notes that internal stack traces and implementation details must never be included in the `message` argument. This is a deliberate design reminder, not an enforced constraint.

---

## Integration with XyPriss

`Send` is a first-party utility of the XyPriss framework. It depends on `XyPrisResponse` from `../server/routing` and on the global `__sys__` object for server identity. It does not introduce any external dependencies.

The class is intended to be instantiated per-request inside route handlers. It holds a reference to the active response object and is not reusable across requests.

```typescript
// Typical integration pattern in a XyPriss controller
import { Send } from "../utils/Send";
import type { XyPrisRequest, XyPrisResponse } from "../server/routing";

export async function getUserById(req: XyPrisRequest, res: XyPrisResponse) {
  const send = new Send(res);
  // ... handler logic
}
```

---

## Type Reference

The following types are defined in `../types/SendUtils` and govern the `Send` API:

| Type               | Description                                                                                       |
|--------------------|---------------------------------------------------------------------------------------------------|
| `ISeConfigs`       | Map of `SupportedStatus` keys to their corresponding HTTP numeric codes.                          |
| `ISeResponder`     | Interface implemented by `Send`, declaring all public response methods.                           |
| `SupportedStatus`  | Union of all valid status key strings (e.g. `"OK"`, `"NOT_FOUND"`, `"INTERNAL_SERVER_ERR"`).    |
| `IResTemplate`     | Shape of every JSON response body produced by `Send`.                                             |
| `TSendPropsFn`     | Signature of the standard response methods: `(message?: string, data?: unknown) => void`.         |

---

Copyright © 2025–2026 NEHONIX. All Rights Reserved.
Licensed under the [Nehonix Open Source License v2.0 (NOSL v2)](https://dll.nehonix.com/licenses/NOSL/v2).

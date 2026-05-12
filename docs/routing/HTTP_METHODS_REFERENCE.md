# XyPriss HTTP Methods Reference

This document provides a detailed overview of all HTTP methods supported by XyPriss, their expected behavior, body-parsing rules, and implementation examples.

---

## Overview

XyPriss provides a complete set of route methods mapping directly to HTTP verbs. All methods are handled by the underlying XHSC engine, ensuring high performance and full compliance with web standards (RFC 7231, RFC 5789).

The framework automatically parses request bodies for methods that typically carry payloads, or when the client sends `Content-Length` or `Transfer-Encoding` headers.

---

## Supported Methods

### GET

Retrieves a resource. No request body is expected. XyPriss automatically parses query string parameters into `req.query`.

```typescript
app.get("/users", (req, res) => {
    const { page = "1", limit = "20" } = req.query;
    res.json({ users: [], page: Number(page), limit: Number(limit) });
});
```

**Rules:**
- `req.body` is not populated on GET requests.
- Safe and idempotent — must not produce side effects.

---

### POST

Submits a new entity to a resource. XyPriss automatically parses JSON and URL-encoded bodies into `req.body`.

```typescript
app.post("/users", (req, res) => {
    const newUser = req.body; // parsed JSON
    res.status(201).json(newUser);
});
```

**Rules:**
- Not idempotent — repeated calls may create duplicate resources.
- Always return `201 Created` with the created resource, or `202 Accepted` for async operations.

---

### PUT

Replaces the entire resource at the target URL with the provided payload. The existing resource is fully overwritten.

```typescript
app.put("/users/:id", (req, res) => {
    const { id } = req.params;
    const userData = req.body;
    res.json({ id, ...userData });
});
```

**Rules:**
- Idempotent — repeating the same PUT produces the same result.
- If the resource does not exist, return `404 Not Found` or `201 Created` depending on your API contract.

---

### PATCH

Applies **partial modifications** to a resource. Only the fields provided in the body are updated; the rest remain unchanged.

```typescript
app.patch("/users/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body; // only the changed fields
    res.json({ id, ...updates });
});
```

**Rules:**
- Not necessarily idempotent (depends on the operation, e.g. incrementing a counter).
- Prefer PATCH over PUT when the client only knows which fields changed.

---

### DELETE

Deletes the specified resource. XyPriss supports request bodies on DELETE, useful for bulk deletions or passing complex criteria.

```typescript
// Single resource
app.delete("/users/:id", (req, res) => {
    const { id } = req.params;
    res.status(204).send();
});

// Bulk deletion with body
app.delete("/users", (req, res) => {
    const { ids } = req.body; // array of IDs
    res.json({ deleted: ids });
});
```

**Rules:**
- Idempotent — deleting an already-deleted resource should return `404`, not an error.
- Return `204 No Content` on success (no response body needed).

---

### OPTIONS

Describes the communication options for a resource. Commonly used by browsers for **CORS preflight** requests.

When CORS is enabled, XyPriss automatically intercepts OPTIONS requests and returns the appropriate `Access-Control-*` headers. You only need a custom handler for non-standard requirements.

```typescript
app.options("/api/*", (req, res) => {
    res.header("Allow", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Origin", "*");
    res.status(204).send();
});
```

**Rules:**
- Must not return a body (only headers matter).
- The `Allow` header must list all supported methods for the given path.

---

### HEAD

Identical to GET, but the response body is **never sent** — only headers. XyPriss executes the routing logic and then strips the body before transmission.

```typescript
app.head("/files/:name", (req, res) => {
    const fileSize = getFileSizeBytes(req.params.name);
    res.set("Content-Length", String(fileSize));
    res.set("Content-Type", "application/octet-stream");
    res.end();
});
```

**Use cases:**
- Checking if a resource exists without downloading it.
- Retrieving metadata (`Content-Length`, `Last-Modified`, `ETag`) before a full GET.

---

### TRACE

Performs a message loop-back test along the path to the target resource. The server echoes the received request back to the client. Useful for debugging proxy chains.

```typescript
app.trace("/debug", (req, res) => {
    res.set("Content-Type", "message/http");
    res.send(`TRACE ${req.url} HTTP/1.1\n${JSON.stringify(req.headers)}`);
});
```

> **Security note:** Disable TRACE in production environments — it can be exploited in Cross-Site Tracing (XST) attacks. Enable it only on internal/debug endpoints with appropriate guards.

---

### CONNECT

Establishes a TCP tunnel to the server identified by the target resource. Primarily used by HTTP proxies to set up TLS tunnels.

```typescript
app.connect("/tunnel", (req, res) => {
    // Signal tunnel establishment
    res.status(200).end();
    // After this point, raw socket is used for data transfer
});
```

**Important behavior:**
- Returning `200 OK` upgrades the connection to a raw tunnel.
- Response bodies in CONNECT responses are non-standard and may be ignored by clients.
- Only implement this if you are building an HTTP proxy server.

---

### app.all()

Matches **all** HTTP methods for a given path. Useful for global middleware applied to a specific section of the API, or as a catch-all handler.

```typescript
// Log every request to /api/*
app.all("/api/*", (req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

// Specific handlers still work — app.all + next() passes through
app.get("/api/users", usersHandler);
```

**Execution order:**
1. `app.all()` handler runs first and calls `next()`.
2. The specific method handler (e.g. `app.get()`) runs next.

---

## Body Parsing Rules

XyPriss uses intelligent body parsing. `req.body` is populated when **any** of the following conditions is true:

| Condition                                     | Notes                                      |
| --------------------------------------------- | ------------------------------------------ |
| HTTP method is `POST`, `PUT`, `PATCH`, `DELETE` | Body parsing is always active for these    |
| `Content-Length` header is present and `> 0`  | Body is read regardless of method          |
| `Transfer-Encoding: chunked` is present       | Chunked body is streamed and assembled     |

**Supported content types:**

| Content-Type                        | Parsed into       |
| ----------------------------------- | ----------------- |
| `application/json`                  | `req.body` (object) |
| `application/x-www-form-urlencoded` | `req.body` (object) |
| `multipart/form-data`               | Requires a plugin |
| Other                               | `req.rawBody` (Buffer) |

---

## HTTP Status Code Quick Reference

| Code | Meaning              | Common use case                              |
| ---- | -------------------- | -------------------------------------------- |
| 200  | OK                   | Successful GET, PUT, PATCH                   |
| 201  | Created              | Successful POST that created a resource      |
| 202  | Accepted             | Async operation started                      |
| 204  | No Content           | Successful DELETE, or PUT with no body       |
| 400  | Bad Request          | Malformed input or validation failure        |
| 401  | Unauthorized         | Missing or invalid credentials               |
| 403  | Forbidden            | Authenticated but lacking permission         |
| 404  | Not Found            | Resource does not exist                      |
| 405  | Method Not Allowed   | Method not supported for this route          |
| 409  | Conflict             | State conflict (e.g. duplicate entry)        |
| 422  | Unprocessable Entity | Semantically invalid payload                 |
| 429  | Too Many Requests    | Rate limit exceeded                          |
| 500  | Internal Server Error| Unhandled exception in the handler           |

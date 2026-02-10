# XyPriss HTTP Methods Reference

This document provides a detailed overview of the HTTP methods supported by the XyPriss web framework, their expected behavior, and implementation details.

## Overview

XyPriss provides a comprehensive set of methods to handle standard HTTP verbs. These methods map directly to the underlying XHSC engine and Node.js HTTP handling mechanisms, ensuring high performance and compliance with web standards.

The framework automatically parses request bodies for methods that typically carry payloads (POST, PUT, PATCH, DELETE) or when specific headers (`Content-Length`, `Transfer-Encoding`) are present.

## Supported Methods

### GET

Used to retrieve resources. XyPriss handles GET requests efficiently, with built-in support for query parameter parsing.

```typescript
app.get("/users", (req, res) => {
    // Access query parameters via req.query
    const limit = req.query.limit;
    res.json({ users: [] });
});
```

### POST

Used to submit entities to the specified resource. XyPriss automatically parses JSON and URL-encoded bodies.

```typescript
app.post("/users", (req, res) => {
    // Access parsed body via req.body
    const newUser = req.body;
    res.status(201).json(newUser);
});
```

### PUT

Used to replace all current representations of the target resource with the request payload.

```typescript
app.put("/users/:id", (req, res) => {
    const userId = req.params.id;
    const userData = req.body;
    // Update logic here
    res.send("User updated");
});
```

### PATCH

Used to apply partial modifications to a resource.

```typescript
app.patch("/users/:id", (req, res) => {
    const updates = req.body;
    res.send("User patched");
});
```

### DELETE

Used to delete the specified resource. Note that XyPriss supports parsing request bodies in DELETE requests, which is useful for bulk deletion operations or passing complex deletion criteria.

```typescript
app.delete("/users", (req, res) => {
    // Request body is available if provided
    const userIds = req.body.ids;
    // Deletion logic
    res.send("Users deleted");
});
```

### OPTIONS

Used to describe the communication options for the target resource.

**Important Behavior**:
In a typical XyPriss setup with CORS enabled, OPTIONS requests (preflight) are often intercepted and handled automatically by the security middleware to return appropriate `Access-Control` headers. If you define a custom OPTIONS handler, ensure it accounts for CORS requirements if necessary.

```typescript
app.options("/api/*", (req, res) => {
    res.header("Allow", "GET, POST, OPTIONS");
    res.send();
});
```

### HEAD

Asks for a response identical to a GET request, but without the response body. XyPriss handles this by executing the routing logic but discarding the response body before transmission, sending only the headers.

```typescript
app.head("/large-resource", (req, res) => {
    // Logic to set headers
    res.set("Content-Length", "1024");
    res.end();
});
```

### TRACE

Performs a message loop-back test along the path to the target resource. This is useful for debugging purposes to see what changes (if any) have been made by intermediate servers.

```typescript
app.trace("/debug", (req, res) => {
    // Logic to echo back the received request
    res.send("Trace received");
});
```

### CONNECT

Establish a tunnel to the server identified by the target resource. XyPriss supports the CONNECT method, which is primarily used for setting up proxy tunnels.

**Note on Behavior**:
When a CONNECT handler returns a 200 OK status, the connection is effectively upgraded to a tunnel. Sending a response body in a CONNECT response is non-standard and may be ignored or mishandled by some clients (like curl). Typically, after the initial handshake, the raw socket is used for data transfer.

```typescript
app.connect("/tunnel", (req, res) => {
    // Establish tunnel logic
    res.status(200).end();
});
```

### app.all()

The `app.all()` method is a special router method that matches **all** HTTP methods (GET, POST, PUT, DELETE, etc.) for a specific path.

This is particularly useful for:

- Defining global logic for a specific section of your API.
- Setting up catch-all handlers or middleware for specific routes.

```typescript
app.all("/api/*", (req, res, next) => {
    console.log("API request received:", req.method, req.url);
    next();
});
```

If a request matches an `app.all()` route and the handler calls `next()`, it will proceed to specific method handlers (e.g., `app.get()`) defined subsequently.

## Body Parsing Rules

XyPriss employs intelligent body parsing logic. The `req.body` is populated if:

1. The HTTP method is POST, PUT, PATCH, or DELETE.
2. The `Content-Length` header is present and greater than 0.
3. The `Transfer-Encoding` header is present (indicating chunked transfer).

This ensures that payloads are correctly processed even for methods where they are optional or less common, provided the client sends the correct headers.


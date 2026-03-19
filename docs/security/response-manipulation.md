# Response Manipulation Middleware

The Response Manipulation Middleware allows for the dynamic modification of JSON response bodies before they are transmitted to the client. This is primarily used for security purposes, such as masking sensitive data, or for data transformation in a multi-tenant environment.

## Features

- **Dot Notation Paths**: Target specific fields in nested objects using standard dot notation (e.g., `user.auth.token`).
- **RegExp Support**: Use literal Regular Expression objects to match and manipulate multiple keys across the entire response structure.
- **Circular Reference Safety**: Built-in support for circular references using XyPriss's high-performance `XStringify` engine.
- **Performance Optimization**: Configurable recursion depth limits and intelligent cloning to ensure stability under heavy load or with extremely large objects.

## Configuration

The middleware is configured within the `responseManipulation` block of the server configuration.

| Property   | Type                         | Description                                                           |
| :--------- | :--------------------------- | :-------------------------------------------------------------------- |
| `enabled`  | `boolean`                    | Global toggle for the manipulation middleware.                        |
| `rules`    | `ResponseManipulationRule[]` | An array of rules defining target fields and their replacement logic. |
| `maxDepth` | `number`                     | Maximum recursion depth for nested objects. Default: `10`.            |

### ResponseManipulationRule

Each rule in the `rules` array follows this structure:

| Property       | Type               | Description                                                                                                       |
| :------------- | :----------------- | :---------------------------------------------------------------------------------------------------------------- |
| `field`        | `string \| RegExp` | (Optional) Target field path (dot notation) or a RegExp object to match keys.                                     |
| `valuePattern` | `RegExp`           | (Optional) RegExp pattern to match against the field's value. Only masks if the value matches.                    |
| `replacement`  | `any`              | Value to replace the target field with.                                                                           |
| `preserve`     | `number`           | If the value is a string, specifies the number of characters to preserve at the beginning while masking the rest. |

## Usage Examples

### 1. Basic Field Masking (Dot Notation)

Mask a specific sensitive field while preserving a portion of its content.

```typescript
responseManipulation: {
  enabled: true,
  rules: [
    { field: "api_key", preserve: 4 }
  ]
}
// Input: { "api_key": "ak-test-xyz-123" }
// Output: { "api_key": "ak-t***********" }
```

### 2. RegExp-Based Multiple Field Masking

Mask all fields whose names end with `_id` or `Secret` across the entire object tree.

```typescript
responseManipulation: {
  enabled: true,
  rules: [
    { field: /.*(_id|Secret)$/, replacement: "[MASKED]" }
  ]
}
// Input: { "user_id": 1, "clientSecret": "abc", "data": { "temp_id": 9 } }
// Output: { "user_id": "[MASKED]", "clientSecret": "[MASKED]", "data": { "temp_id": "[MASKED]" } }
```

### 3. Surgical Content Masking (valuePattern)

Mask fields only if their content matches a specific pattern (e.g., hiding Prisma/database internals).

```typescript
responseManipulation: {
  enabled: true,
  rules: [
    {
      valuePattern: /prisma\./i,
      replacement: "An internal error occurred. Please contact support."
    }
  ]
}
```

// Input: { "message": "PrismaClientKnownRequestError: Invalid prisma.user.findUnique()..." }
// Output: { "message": "An internal error occurred. Please contact support." }

### 4. Depth-Limited Deep Object Masking

Ensure performance on large objects by limiting the depth of manipulation.

```typescript
responseManipulation: {
  enabled: true,
  maxDepth: 5,
  rules: [
    { field: "user.private_data", replacement: "[HIDDEN]" }
  ]
}
```

## Internal Implementation Details

The middleware uses a two-phase process for safety and performance:

1. **Cloning**: The response body is cloned using `XStringify` and `JSON.parse`. This allows for safe mutation without affecting the internal state of the request cycle or other connected clients.
2. **Recursive Traversal**: The middleware performs a depth-limited recursive traversal of the cloned object. Rules are applied in the order they are defined in the configuration.

> [!NOTE]
> The middleware only processes objects where `typeof data === 'object'`. Non-object responses (strings, numbers, buffers) are passed through without modification.


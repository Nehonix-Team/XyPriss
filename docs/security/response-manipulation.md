# Response Manipulation Middleware (XHSC)

The Response Manipulation Middleware allows for the dynamic modification of JSON response bodies before they are transmitted to the client. This is primarily used for security purposes, such as masking sensitive data, or for data transformation in a multi-tenant environment. 

> [!NOTE]
> As of version **XHSC71226G4**, this middleware is natively executed in Go (XHSC) instead of Node.js. It operates on the raw JSON payload before any compression algorithm (zstd, gzip) is applied.

## Features

- **Dot Notation Paths**: Target specific fields in nested objects using standard dot notation (e.g., `database.credentials.password`). Dot notation rules have the highest priority and overwrite generic rules.
- **RegExp Support**: Use literal Regular Expression objects to match and manipulate multiple keys across the entire response structure.
- **Automatic Object Masking**: If a generic regex rule matches the key of a deeply nested object or array, the entire structural node is safely nuked and replaced with `[HIDDEN OBJECT]`.
- **Go-Native Parsing**: High-performance JSON traversal and regex compilation using `sonic` and `re2`, bypassing the Node.js event loop completely.
- **Performance Optimization**: Configurable recursion depth limits to ensure stability under heavy load or with extremely large objects.

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
| `valuePattern` | `RegExp`           | (Optional) RegExp pattern to match against the field's value. Only masks if the value matches. If `field` is omitted, it acts as a global rule on all string values. |
| `replacement`  | `any`              | Value to replace the target field with.                                                                           |
| `preserve`     | `number`           | If the value is a string, specifies the number of characters to preserve at the beginning while masking the rest. |

## Execution Order & Precedence

To avoid conflicting rules and ensure predictable masking, XHSC enforces a strict execution hierarchy during tree traversal:

1. **Recursive Bottom-Up Traversal**: The middleware traverses the JSON tree and applies generic string rules (`field` or `valuePattern`) at every nested level.
2. **Object/Array Nuke Policy**: If a `field` regex rule matches a key that contains an array or object instead of a primitive string, the engine replaces the entire collection with `[HIDDEN OBJECT]` to prevent unintended leakage of inner values.
3. **Dot-Path Precedence**: `applyDotPath` rules (e.g. `database.credentials.password`) are evaluated **last**, and strictly from the root level. This ensures that explicit structural overrides will systematically overwrite any generic masking applied by regex rules during the recursive phase.

## Usage Examples

### 1. Basic Field Masking (Dot Notation)

Mask a specific sensitive field inside a nested object. Because it uses dot-notation, it will overwrite any generic rule that might have applied to the same key.

```typescript
responseManipulation: {
  enabled: true,
  rules: [
    { field: "database.credentials.password", replacement: "[DB_PASSWORD_HIDDEN]" }
  ]
}
```

### 2. RegExp-Based Multiple Field Masking

Mask all fields containing `password`, `token`, or `apikey`. Note: use standard JS Regex modifiers (e.g., `/pattern/i`). Do not use inline modifiers like `/(?i)pattern/`.

```typescript
responseManipulation: {
  enabled: true,
  rules: [
    { field: /password|token|secret|api_?key/i, preserve: 0 }
  ]
}
```
> [!WARNING]
> If your regex is too broad (e.g., `/apikey/i`) and matches a key containing an array (e.g., `apiKeys: [...]`), the entire array will be replaced by `[HIDDEN OBJECT]`.

### 3. Surgical Content Masking (Global valuePattern)

Mask any string value matching a specific pattern across the entire JSON tree, regardless of the key name (e.g., hiding database stack traces or JWT tokens).

```typescript
responseManipulation: {
  enabled: true,
  rules: [
    {
      valuePattern: /database error:[\s\S]*?failed at line/gis,
      preserve: 15
    },
    {
      valuePattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
      preserve: 10
    }
  ]
}
```

## Internal Implementation Details

The middleware works seamlessly with compression:
1. **Raw Interception**: `ResponseManipulationMiddleware` sits inside `CompressionMiddleware`. It intercepts the raw JSON directly from the upstream router.
2. **Deserialization**: It leverages `sonic` to unmarshal the payload into memory.
3. **Traversal**: It applies the security masks via recursive mapping.
4. **Reserialization & Compression**: It serializes the sanitized object back to JSON bytes and forwards them to `CompressionMiddleware` to be compressed (if the payload exceeds the compression threshold, typically 1024 bytes).

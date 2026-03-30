# Path (`__sys__.path`)

The `__sys__.path` module (via the `PathApi` class) provides an uncompromised, cross-platform set of rules to deal with directory boundaries and references natively.

## Resolution and Join

### `resolve(...paths: string[]): string`

Computes an absolute canonical sequence from provided segments. It resolves semantic tokens like `.` or `..` and links them with the system's root.

```typescript
const absPath = __sys__.path.resolve("config", "main.json");
```

### `join(...paths: string[]): string`

Concatenates segments cleanly, pruning any duplicated trailing or leading structural slashes for OS safety.

```typescript
const partial = __sys__.path.join("var", "www", "html");
```

---

## Directory and File Segmentation

- **`dirname(p: string): string`**: Truncates the path to its deepest directory parent structure.
- **`basename(p: string, suffix?: string): string`**: Isolates the end file name sequence; strips matching extensions if requested.
- **`extname(p: string): string`**: Gathers the concluding dot-prefixed file format type (e.g. `.ts`).
- **`metadata(p: string)`**: Returns comprehensive descriptors including `{ dir, base, ext, name, isAbsolute }` in a single high-speed invocation.

---

## Evaluation and Validation

### `isAbsolute(p: string): boolean`

Confirms if the sequence represents a definitive starting point mapped to drive letters or base system mounts.

### `relative(from: string, to: string): string`

Generates navigational step instructions required to link the starting bound to the desired destination correctly.

```typescript
const route = __sys__.path.relative("/var/logs", "/var/config");
// -> "../config"
```

### `exists(p: string): boolean`

Verifies if a file or directory explicitly exists at the given path.

### `isDir(p: string): boolean` / `isFile(p: string): boolean` / `isSymlink(p: string): boolean`

Evaluates the physical structure of the target location.

### `isEmpty(p: string): boolean`

Checks whether a file has `0` bytes or if a directory contains no items.

### `tempDir(): string`

Returns the operating system's default directory for temporary files.

---

## Security and Containment

### `isChild(parent: string, child: string): boolean`

Ascertains that a generated file path categorically resolves within an anticipated directory structure, blocking escape attacks.

### `secureJoin(base: string, ...segments: string[]): string`

Merges content enforcing that the newly formulated address implicitly operates inside the `base` scope. Any directory traversal anomalies evaluate strictly to protected limits or throw fatal events.

```typescript
const input = "../../mnt/unsafe";
const clean = __sys__.path.secureJoin("/jail", input);
```

### `normalizeSeparators(p: string): string`

Restricts all incoming `/` or `\` formatting constructs forcefully rewriting them to the recognized separator format applicable to the executing OS.


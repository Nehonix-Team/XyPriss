# Dynamic Variables (`__xhsc__.vars`)

The `__xhsc__.vars` module (via the `VarsApi` class) provides the application with a structured key-value store, enabling the centralization of global parameters, build configuration, and software metadata.

## Built-in Global Properties

These properties have explicit formal keys, ensuring IntelliSense support during development:

- `__version__` (string): Current software version.
- `__author__` (string): Author or creative identity.
- `__description__` (string): Summary or purpose of the application.
- `__app_urls__` (Record<string, string>): Dictionary of addresses or endpoints related to the project.
- `__name__` (string): General identifier of the project.
- `__alias__` (string): Short name (alias) or shortcut for the project entity.
- `__port__` / `__PORT__` (number): Default allocated execution port.
- `__root__` (string): Absolute and static root of the execution directory on disk.

## Variable Management Methods

### `get(key: string, defaultValue?: any): any`

Securely retrieves the value associated with the identifier. The mechanism checks explicit global properties before the underlying map.

```typescript
const themeColor = __xhsc__.vars.get("theme", "standard-dark");
```

### `set(key: string, value: any): void`

Instantiates or overwrites a dynamic variable within the architecture.

```typescript
__xhsc__.vars.set("max_retries", 5);
```

### `has(key: string): boolean`

Formally evaluates the presence of a key.

```typescript
if (__xhsc__.vars.has("temp_migration_flag")) {
    proceedWithMigration();
}
```

### `delete(key: string): void`

Eradicates the linked entry from application memory.

### `update(data: Record<string, any>): void`

Iteratively merges a complex data block into the store, provided the keys do not simulate native references (without a `$` prefix) and do not contain direct functions.

```typescript
__xhsc__.vars.update({
    cache_ttl: 3600,
    allow_guests: false,
});
```

---

## Extraction and Utility Methods

- **`keys(): string[]`**:
  Analyzes and returns an exhaustive collection of parameter names (explicit and dynamic).
- **`all(): Record<string, any>`**:
  Generates a consolidated representation of the entire current store.
- **`toJSON(): Record<string, any>`**:
  Optimized proxy method for displaying or encoding information to other serialized streams.
- **`clone(): Record<string, any>`**:
  Invokes a robust and unlinked memory copy, preventing collateral mutation of source integrity variables.
- **`clear(): void`**:
  Destructive action deleting all volatile injected keys without affecting the initial skeleton.


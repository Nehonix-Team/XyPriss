# XyPriss System Utilities (`__sys__.utils`)

The `utils` module provides a comprehensive suite of high-performance utility functions designed for professional application development. The module is secondary to the core system APIs and is globally accessible via `__sys__.utils`.

To improve maintainability and readability, the documentation has been modularized into specialized categories.

## Architectural Overview

The utility suite is partitioned into the following specialized modules:

| Module         | Description                                            | API Link                              |
| :------------- | :----------------------------------------------------- | :------------------------------------ |
| **Strings**    | Normalization, slugs, random strings, and formatting.  | [View Details](./utils/strings.md)    |
| **Numbers**    | Math operations, byte formatting, and clamping.        | [View Details](./utils/numbers.md)    |
| **Dates**      | Calendar arithmetic, relative time, and smart parsing. | [View Details](./utils/dates.md)      |
| **Data**       | Deep object cloning and advanced array management.     | [View Details](./utils/data.md)       |
| **Logic**      | Asynchronous control flow and validation guards.       | [View Details](./utils/logic.md)      |
| **Primitives** | Core identity (UUID) and functional helpers (Memoize). | [View Details](./utils/primitives.md) |

---

## Global Access

All utilities are instantiated and exposed through the `UtilsApi` class, accessible globally via `__sys__.utils`.

```typescript
// Example usage:
const id = __sys__.utils.id.uuid();
const bytes = __sys__.utils.num.formatBytes(1234567);
const slug = __sys__.utils.str.slugify("Hello World");
```

---

## Technical Philosophy

1. **Granularity**: Functions are categorized into logical groups for better IDE discoverability.
2. **Performance**: Built on native APIs (`Intl`, `crypto`, etc.) with zero external dependencies.
3. **Ergonomics**: Concise naming conventions (`str`, `is`, `id`, `fn`) minimize boilerplate and improve readablity.
4. **Reliability**: Pure functions that maintain immutability where possible.


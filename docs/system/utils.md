# XyPriss System Utilities (`__sys__.utils`)

The `utils` module provides a comprehensive suite of high-performance utility functions globally accessible via `__sys__.utils`.

## Modules Summary

| Module         | Description                                            | API Documentation                |
| :------------- | :----------------------------------------------------- | :------------------------------- |
| **Strings**    | Normalization, slugs, random strings, and formatting.  | [str](./utils/strings.md)        |
| **Numbers**    | Math operations, byte formatting, and clamping.        | [num](./utils/numbers.md)        |
| **Dates**      | Calendar arithmetic, relative time, and smart parsing. | [date](./utils/dates.md)         |
| **Data**       | Deep object cloning and advanced array management.     | [obj / arr](./utils/data.md)     |
| **Logic**      | Asynchronous control flow and validation guards.       | [async / is](./utils/logic.md)   |
| **Primitives** | Core identity (UUID) and functional helpers (Memoize). | [id / fn](./utils/primitives.md) |

---

## Global Access

All utilities are accessible via the `__sys__.utils` namespace:

```typescript
const id = __sys__.utils.id.uuid();
const bytes = __sys__.utils.num.formatBytes(1234567);
const date = __sys__.utils.date.format(Date.now());
```


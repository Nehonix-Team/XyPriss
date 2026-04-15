import { StringUtils } from "./utils/StringUtils";
import { NumberUtils } from "./utils/NumberUtils";
import { DateUtils } from "./utils/DateUtils";
import { ObjectUtils } from "./utils/ObjectUtils";
import { ArrayUtils } from "./utils/ArrayUtils";
import { AsyncUtils } from "./utils/AsyncUtils";
import { ValidationUtils } from "./utils/ValidationUtils";
import { IdUtils } from "./utils/IdUtils";
import { FunctionUtils } from "./utils/FunctionUtils";

/**
 * **UtilsApi — XyPriss System Utility Module**
 *
 * A comprehensive, high-performance utility class for application development.
 * Utilities are grouped into specialized categories for better modularity.
 *
 * Exposed via `__sys__.utils`.
 *
 * @example
 * ```ts
 * __sys__.utils.num.formatBytes(1048576);      // "1 MB"
 * __sys__.utils.is.email("test@example.com");  // true
 * __sys__.utils.id.uuid();                     // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export class UtilsApi {
    /** **String Utilities** (`slugify`, `truncate`, `randomString`, etc.) */
    public readonly str = new StringUtils();

    /** **Number & Math Utilities** (`clamp`, `lerp`, `formatBytes`, etc.) */
    public readonly num = new NumberUtils();

    /** **Date & Time Utilities** (`formatDuration`, `timeAgo`, etc.) */
    public readonly date = new DateUtils();

    /** **Object Utilities** (`deepClone`, `parse`, `pick`, etc.) */
    public readonly obj = new ObjectUtils();

    /** **Array Utilities** (`chunk`, `unique`, `groupBy`, etc.) */
    public readonly arr = new ArrayUtils();

    /** **Async & Control Flow Utilities** (`sleep`, `retry`, `debounce`, etc.) */
    public readonly async = new AsyncUtils();

    /** **Validation Utilities** (`email`, `url`, `nullish`) */
    public readonly is = new ValidationUtils();

    /** **Identity Utilities** (`uuid`) */
    public readonly id = new IdUtils();

    /** **Functional Utilities** (`memo`) */
    public readonly fn = new FunctionUtils();
}


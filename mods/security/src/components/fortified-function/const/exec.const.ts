import { SecureExecutionContext } from "../types/types";

// **ULTRA-FAST OPTIMIZATION: Pre-compiled function cache**
const FUNCTION_CACHE = new Map<string, any>();
const HASH_CACHE = new Map<string, string>();
const EXECUTION_CACHE = new Map<string, any>();

// **ULTRA-FAST OPTIMIZATION: Reusable objects to avoid GC pressure**
const CONTEXT_POOL: SecureExecutionContext[] = [];
const ID_POOL: string[] = [];
const BUFFER_POOL: Map<string, any>[] = [];

// **ULTRA-FAST OPTIMIZATION: Pre-compiled regex patterns**
const STACK_SANITIZE_REGEX = /\s+at\s+.*\(.*\)/g;
const PARAM_HASH_REGEX = /[^\w\s]/g;

export {
    FUNCTION_CACHE,
    HASH_CACHE,
    EXECUTION_CACHE,
    CONTEXT_POOL,
    ID_POOL,
    BUFFER_POOL,
    STACK_SANITIZE_REGEX,
    PARAM_HASH_REGEX,
};

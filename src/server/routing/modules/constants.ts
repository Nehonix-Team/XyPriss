/** Typed param extraction regex */
export const TYPED_PARAM_REGEX =
    /:([a-zA-Z_$][a-zA-Z0-9_$]*)(?:<([^>]+)>)?(?:\(([^)]+)\))?/g;

/** Built-in param patterns for typed routing */
export const BUILTIN_PARAM_PATTERNS: Record<string, string> = {
    number: "-?\\d+(?:\\.\\d+)?",
    integer: "-?\\d+",
    boolean: "true|false",
    uuid: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    alpha: "[a-zA-Z]+",
    alphanumeric: "[a-zA-Z0-9]+",
    string: "[^/]+",
};
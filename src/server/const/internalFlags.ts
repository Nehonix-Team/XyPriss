/**
 * List of internal framework flags that are securely passed via `withInternalFlag`
 * and validated via `rejectInternalFlag`.
 */
export const internalFlags = [
    "isAuxiliary",
    "isWorker",
    "_isAuxiliary",
    "_isWorker"
] as const;

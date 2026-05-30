
// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * All HTTP status keys supported by the `Send` helper.
 * Each key maps to a standard HTTP status code.
 *
 * — 2xx  Success
 * — 3xx  Redirection
 * — 4xx  Client errors
 * — 5xx  Server errors
 */
export type SupportedStatus =
    // ── 2xx ──────────────────────────────────────────────────────────────────
    | "OK"
    | "CREATED"
    | "ACCEPTED"
    | "NO_CONTENT"
    // ── 3xx ──────────────────────────────────────────────────────────────────
    | "MOVED_PERMANENTLY"
    | "FOUND"
    | "NOT_MODIFIED"
    // ── 4xx ──────────────────────────────────────────────────────────────────
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "METHOD_NOT_ALLOWED"
    | "NOT_ACCEPTABLE"
    | "CONFLICT"
    | "GONE"
    | "UNPROCESSABLE_ENTITY"
    | "LOCKED"
    | "TOO_MANY_REQUEST"
    | "PAYLOAD_TOO_LARGE"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "REQUEST_TIMEOUT"
    | "PRECONDITION_FAILED"
    | "EXPECTATION_FAILED"
    | "IM_A_TEAPOT"
    // ── 5xx ──────────────────────────────────────────────────────────────────
    | "INTERNAL_SERVER_ERR"
    | "NOT_IMPLEMENTED"
    | "BAD_GATEWAY"
    | "SERVICE_UNAVAILABLE"
    | "GATEWAY_TIMEOUT";

/**
 * Maps every {@link SupportedStatus} key to its corresponding HTTP status code.
 */
export type ISeConfigs = Record<SupportedStatus, number>;

/**
 * Signature shared by all public dispatch methods.
 *
 * @param message - Human-readable description shown to the API consumer.
 * @param data    - Optional payload to attach to the response body.
 */
export type TSendPropsFn = (message?: string, data?: unknown) => void;

/**
 * Contract that the {@link Send} class must satisfy.
 */
export interface ISeResponder {
    // 2xx
    ok: TSendPropsFn;
    created: TSendPropsFn;
    accepted: TSendPropsFn;
    noContent: () => void;
    // 3xx
    movedPermanently: TSendPropsFn;
    found: TSendPropsFn;
    notModified: () => void;
    // 4xx
    badRequest: TSendPropsFn;
    unauthorized: TSendPropsFn;
    forbidden: TSendPropsFn;
    notFound: TSendPropsFn;
    methodNotAllowed: TSendPropsFn;
    notAcceptable: TSendPropsFn;
    conflict: TSendPropsFn;
    gone: TSendPropsFn;
    unprocessableEntity: TSendPropsFn;
    locked: TSendPropsFn;
    tooManyRequest: TSendPropsFn;
    payloadTooLarge: TSendPropsFn;
    unsupportedMediaType: TSendPropsFn;
    requestTimeout: TSendPropsFn;
    preconditionFailed: TSendPropsFn;
    expectationFailed: TSendPropsFn;
    imATeapot: TSendPropsFn;
    // 5xx
    internalError: TSendPropsFn;
    notImplemented: TSendPropsFn;
    badGateway: TSendPropsFn;
    serviceUnavailable: TSendPropsFn;
    gatewayTimeout: TSendPropsFn;
}

/**
 * Shape of every JSON response body produced by this helper.
 *
 * @property success    - `true` for 2xx responses, `false` for everything else.
 * @property message    - Human-readable summary of the outcome.
 * @property serverName - Identifier of the server that handled the request.
 * @property data       - Optional payload (echoed from the caller when relevant).
 * @property details    - Machine-readable metadata about the response.
 */
export interface IResTemplate {
    success: boolean;
    message: string;
    serverName?: string;
    data?: unknown;
    details: {
        /** Short label (e.g. `"Bad Request"`, `"OK"`). */
        error: string;
        /** Compact code derived from the status key (e.g. `"EBADR"`, `"SOK"`). */
        statusCode: number;
        /** The HTTP status code that was sent. */
        errorCode: string;
    };
}

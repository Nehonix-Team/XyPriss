/**
 * @file Send.ts
 * @description Structured HTTP error & success response helper for the XyPriss framework.
 *
 * @copyright Copyright © 2025–2026 NEHONIX. All Rights Reserved.
 * @license NEHONIX Open Source License v2.0 (NOSL v2)
 *          https://dll.nehonix.com/licenses/NOSL/v2
 *
 * This file is part of a NEHONIX open source project.
 * You may use, modify, and redistribute it freely — including for commercial
 * purposes — provided that NEHONIX is always credited as the original author.
 *
 * @author NEHONIX
 */

import { XyPrisResponse } from "../server/routing";
import { ISeConfigs, ISeResponder, SupportedStatus, IResTemplate, TSendPropsFn } from "../types/SendUtils";

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////SEND//////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a compact, uppercase code from a {@link SupportedStatus} key.
 * Error codes start with `"E"`, success codes start with `"S"`.
 *
 * @example
 * buildStatusCode("BAD_REQUEST")         // → "EBADR"
 * buildStatusCode("INTERNAL_SERVER_ERR") // → "EINTE"
 * buildStatusCode("OK")                  // → "SOK"
 * buildStatusCode("CREATED")             // → "SCREA"
 *
 * @param status  - The status key to convert.
 * @param success - Whether this is a success response.
 * @returns A short uppercase code prefixed with `"S"` or `"E"`.
 */
function buildStatusCode(status: SupportedStatus, success: boolean): string {
    const prefix = success ? "S" : "E";
    return prefix + status.replace(/_/g, "").slice(0, 4).toUpperCase();
}

// ---------------------------------------------------------------------------
// Default HTTP status code registry
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS: ISeConfigs = {
    // 2xx
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    // 3xx
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,
    // 4xx
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    UNSUPPORTED_MEDIA_TYPE: 415,
    EXPECTATION_FAILED: 417,
    IM_A_TEAPOT: 418,
    UNPROCESSABLE_ENTITY: 422,
    LOCKED: 423,
    TOO_MANY_REQUEST: 429,
    // 5xx
    INTERNAL_SERVER_ERR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
};

// ---------------------------------------------------------------------------
// Send class
// ---------------------------------------------------------------------------

/**
 * A structured HTTP response helper that standardises all responses across
 * the application — both success and error paths.
 *
 * Every method sends a JSON body conforming to {@link IResTemplate}, ensuring
 * consistent shapes for API consumers regardless of where the response
 * originates.
 *
 * @example
 * ```ts
 * const send = new Send(res);
 *
 * // ── 2xx ──────────────────────────────────────────────────────────────────
 * send.ok("User fetched.", { id: 1, name: "Alice" });
 * send.created("User created.", { id: 42 });
 * send.accepted("Your export is being processed.");
 * send.noContent();
 *
 * // ── 4xx ──────────────────────────────────────────────────────────────────
 * send.badRequest("The 'email' field is required.");
 * send.unauthorized("Please log in to continue.");
 * send.forbidden("You do not have permission to access this resource.");
 * send.notFound("User not found.", { userId: 42 });
 * send.methodNotAllowed("POST is not allowed on this endpoint.");
 * send.conflict("A user with this email already exists.");
 * send.gone("This resource has been permanently deleted.");
 * send.unprocessableEntity("Validation failed.", { fields: { email: "Invalid format" } });
 * send.tooManyRequest("Rate limit reached. Try again in 60 seconds.");
 * send.payloadTooLarge("File exceeds the 10 MB limit.");
 * send.unsupportedMediaType("Only application/json is accepted.");
 *
 * // ── 5xx ──────────────────────────────────────────────────────────────────
 * send.internalError("An unexpected error occurred.");
 * send.notImplemented("This feature is not yet available.");
 * send.serviceUnavailable("The server is temporarily down for maintenance.");
 * send.gatewayTimeout("The upstream service did not respond in time.");
 * ```
 */
export class Send implements ISeResponder {
    private readonly res: XyPrisResponse;
    private readonly configs: ISeConfigs;
    private readonly serverName: string;
    private readonly includeServerName: boolean;

    /**
     * Creates a new `Send` instance bound to the given response object.
     *
     * @param res     - The active `XyPrisResponse` to write into.
     * @param configs - Optional overrides for the default status-code registry
     *                  and display options.
     */
    constructor(
        res: XyPrisResponse,
        configs: Partial<{
            statusCode: Partial<ISeConfigs>;
            includeServerName: boolean;
        }> = {
            includeServerName: true,
            statusCode: {},
        },
    ) {
        this.res = res;
        this.configs = { ...DEFAULT_CONFIGS, ...configs.statusCode };
        this.serverName = __sys__.vars.__name__;
        this.includeServerName = configs?.includeServerName!;
    }

    // -------------------------------------------------------------------------
    // Core dispatcher
    // -------------------------------------------------------------------------

    /**
     * Resolves the status code, builds the full response body, and flushes it.
     *
     * @param statusKey  - One of the {@link SupportedStatus} keys.
     * @param label      - Human-readable short label for the status type.
     * @param success    - Whether this is a success response.
     * @param message    - Optional caller-supplied message; falls back to `label`.
     * @param data       - Optional payload to attach to the response body.
     */
    private dispatch(
        statusKey: SupportedStatus,
        label: string,
        success: boolean,
        message?: string,
        data?: unknown,
    ): void {
        const statusCode = this.configs[statusKey];

        const body: IResTemplate = {
            success,
            message: message ?? label,
            ...(this.includeServerName && { serverName: this.serverName }),
            ...(data !== undefined && { data }),
            details: {
                error: label,
                errorCode: buildStatusCode(statusKey, success),
                statusCode,
            },
        };

        this.res.status(statusCode).xJson(body);
    }

    // =========================================================================
    // 2xx — Success
    // =========================================================================

    /**
     * Sends a **200 OK** response.
     *
     * The standard success response for GET, PUT, PATCH, or DELETE requests
     * that return a body.
     *
     * @param message - Human-readable confirmation.
     * @param data    - Payload to return to the client.
     *
     * @example
     * send.ok("User fetched successfully.", { id: 1, name: "Alice" });
     */
    public ok: TSendPropsFn = (message, data) => {
        this.dispatch("OK", "OK", true, message, data);
    };

    /**
     * Sends a **201 Created** response.
     *
     * Use after successfully creating a new resource.
     * Consider also setting a `Location` header pointing to the new resource.
     *
     * @param message - Human-readable confirmation.
     * @param data    - The newly created resource or its identifier.
     *
     * @example
     * send.created("User created.", { id: 42 });
     */
    public created: TSendPropsFn = (message, data) => {
        this.dispatch("CREATED", "Created", true, message, data);
    };

    /**
     * Sends a **202 Accepted** response.
     *
     * Use when the request has been accepted but processing will happen
     * asynchronously (e.g. background jobs, email dispatch, report generation).
     *
     * @param message - Human-readable explanation of what will happen.
     * @param data    - Optional tracking info (e.g. job ID).
     *
     * @example
     * send.accepted("Your export is being processed.", { jobId: "abc-123" });
     */
    public accepted: TSendPropsFn = (message, data) => {
        this.dispatch("ACCEPTED", "Accepted", true, message, data);
    };

    /**
     * Sends a **204 No Content** response.
     *
     * Use after a successful DELETE or an action that produces no body.
     * RFC 7231 forbids a body for 204 — this method sends status only.
     *
     * @example
     * send.noContent();
     */
    public noContent = (): void => {
        this.res.status(this.configs["NO_CONTENT"]).end();
    };

    // =========================================================================
    // 3xx — Redirection
    // =========================================================================

    /**
     * Sends a **301 Moved Permanently** response.
     *
     * Use when a resource has been permanently relocated. Clients and search
     * engines should update their references.
     *
     * @param message - Optional explanation or the new URL.
     * @param data    - Optional payload (e.g. `{ location: "https://…" }`).
     *
     * @example
     * send.movedPermanently("This endpoint has moved.", { location: "/v2/users" });
     */
    public movedPermanently: TSendPropsFn = (message, data) => {
        this.dispatch(
            "MOVED_PERMANENTLY",
            "Moved Permanently",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **302 Found** response.
     *
     * Use for temporary redirects. The client should continue using the
     * original URL for future requests.
     *
     * @param message - Optional explanation or the temporary URL.
     * @param data    - Optional payload (e.g. `{ location: "https://…" }`).
     *
     * @example
     * send.found("Redirecting to login.", { location: "/auth/login" });
     */
    public found: TSendPropsFn = (message, data) => {
        this.dispatch("FOUND", "Found", false, message, data);
    };

    /**
     * Sends a **304 Not Modified** response.
     *
     * Use with conditional requests (`If-None-Match`, `If-Modified-Since`).
     * Tells the client its cached version is still valid.
     *
     * @example
     * send.notModified();
     */
    public notModified = (): void => {
        this.res.status(this.configs["NOT_MODIFIED"]).end();
    };

    // =========================================================================
    // 4xx — Client Errors
    // =========================================================================

    /**
     * Sends a **400 Bad Request** response.
     *
     * Use when the client submits a malformed or invalid request
     * (e.g. missing required fields, invalid format, constraint violation).
     *
     * @param message - Human-readable explanation of why the request was rejected.
     * @param data    - Optional payload (e.g. a list of validation errors per field).
     *
     * @example
     * send.badRequest("The 'username' field must be at least 3 characters.");
     * send.badRequest("Validation failed.", { fields: { email: "Invalid format" } });
     */
    public badRequest: TSendPropsFn = (message, data) => {
        this.dispatch("BAD_REQUEST", "Bad Request", false, message, data);
    };

    /**
     * Sends a **401 Unauthorized** response.
     *
     * Use when the request lacks valid authentication credentials.
     * Despite the name, this is an *authentication* failure — not authorisation.
     *
     * @param message - Human-readable explanation (avoid leaking token details).
     * @param data    - Optional payload (e.g. `{ authScheme: "Bearer" }`).
     *
     * @example
     * send.unauthorized("Authentication token is missing or expired.");
     */
    public unauthorized: TSendPropsFn = (message, data) => {
        this.dispatch("UNAUTHORIZED", "Unauthorized", false, message, data);
    };

    /**
     * Sends a **403 Forbidden** response.
     *
     * Use when the client is authenticated but lacks permission to access
     * the resource. Unlike 401, re-authenticating will not help.
     *
     * @param message - Human-readable explanation of the permission boundary.
     * @param data    - Optional payload (e.g. required role/scope info).
     *
     * @example
     * send.forbidden("You do not have permission to delete this resource.");
     * send.forbidden("Admin role required.", { requiredRole: "admin" });
     */
    public forbidden: TSendPropsFn = (message, data) => {
        this.dispatch("FORBIDDEN", "Forbidden", false, message, data);
    };

    /**
     * Sends a **404 Not Found** response.
     *
     * Use when the requested resource does not exist or has been permanently removed.
     *
     * @param message - Human-readable explanation of what could not be found.
     * @param data    - Optional payload (e.g. the identifier that was looked up).
     *
     * @example
     * send.notFound("No user found with id '42'.");
     * send.notFound("Resource not found.", { id: "42" });
     */
    public notFound: TSendPropsFn = (message, data) => {
        this.dispatch("NOT_FOUND", "Not Found", false, message, data);
    };

    /**
     * Sends a **405 Method Not Allowed** response.
     *
     * Use when the HTTP method used is not supported on the target endpoint.
     * Always pair this with an `Allow` header listing permitted methods.
     *
     * @param message - Human-readable explanation of the allowed methods.
     * @param data    - Optional payload (e.g. `{ allowedMethods: ["GET", "POST"] }`).
     *
     * @example
     * send.methodNotAllowed("Only GET and POST are allowed on this route.");
     * send.methodNotAllowed("Method not allowed.", { allowedMethods: ["GET", "POST"] });
     */
    public methodNotAllowed: TSendPropsFn = (message, data) => {
        this.dispatch(
            "METHOD_NOT_ALLOWED",
            "Method Not Allowed",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **406 Not Acceptable** response.
     *
     * Use when the server cannot produce a response matching the client's
     * `Accept` header (content-type negotiation failure).
     *
     * @param message - Human-readable explanation of supported content types.
     * @param data    - Optional payload (e.g. `{ supportedTypes: ["application/json"] }`).
     *
     * @example
     * send.notAcceptable("This API only serves application/json.");
     */
    public notAcceptable: TSendPropsFn = (message, data) => {
        this.dispatch("NOT_ACCEPTABLE", "Not Acceptable", false, message, data);
    };

    /**
     * Sends a **408 Request Timeout** response.
     *
     * Use when the server times out waiting for the client to complete its
     * request within the allowed time window.
     *
     * @param message - Human-readable explanation of the timeout.
     * @param data    - Optional payload (e.g. `{ timeoutMs: 5000 }`).
     *
     * @example
     * send.requestTimeout("The request took too long. Please try again.");
     */
    public requestTimeout: TSendPropsFn = (message, data) => {
        this.dispatch(
            "REQUEST_TIMEOUT",
            "Request Timeout",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **409 Conflict** response.
     *
     * Use when the request conflicts with the current state of the resource
     * (e.g. duplicate entry, optimistic-lock violation, concurrent edit clash).
     *
     * @param message - Human-readable explanation of the conflict.
     * @param data    - Optional payload (e.g. the conflicting resource).
     *
     * @example
     * send.conflict("A user with this email already exists.");
     * send.conflict("Edit conflict detected.", { existingVersion: 3, yourVersion: 2 });
     */
    public conflict: TSendPropsFn = (message, data) => {
        this.dispatch("CONFLICT", "Conflict", false, message, data);
    };

    /**
     * Sends a **410 Gone** response.
     *
     * Use when a resource has been *permanently* deleted and will not return.
     * Prefer 404 when you don't want to reveal whether the resource ever existed.
     *
     * @param message - Human-readable explanation of the permanent removal.
     * @param data    - Optional payload (e.g. deletion date).
     *
     * @example
     * send.gone("This account has been permanently deleted.");
     */
    public gone: TSendPropsFn = (message, data) => {
        this.dispatch("GONE", "Gone", false, message, data);
    };

    /**
     * Sends a **412 Precondition Failed** response.
     *
     * Use when a conditional request (`If-Match`, `If-Unmodified-Since`) fails
     * because the precondition evaluated to false on the server.
     *
     * @param message - Human-readable explanation of the failed precondition.
     * @param data    - Optional payload (e.g. current ETag or last-modified date).
     *
     * @example
     * send.preconditionFailed("ETag mismatch — resource was modified since your last fetch.");
     */
    public preconditionFailed: TSendPropsFn = (message, data) => {
        this.dispatch(
            "PRECONDITION_FAILED",
            "Precondition Failed",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **413 Payload Too Large** response.
     *
     * Use when the request body exceeds the server's or route's size limit.
     *
     * @param message - Human-readable explanation including the size limit when safe.
     * @param data    - Optional payload (e.g. `{ maxBytes: 10_485_760 }`).
     *
     * @example
     * send.payloadTooLarge("File exceeds the 10 MB limit.");
     * send.payloadTooLarge("Request body too large.", { maxBytes: 10_485_760 });
     */
    public payloadTooLarge: TSendPropsFn = (message, data) => {
        this.dispatch(
            "PAYLOAD_TOO_LARGE",
            "Payload Too Large",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **415 Unsupported Media Type** response.
     *
     * Use when the `Content-Type` or encoding sent by the client is not
     * supported by the endpoint.
     *
     * @param message - Human-readable explanation of accepted media types.
     * @param data    - Optional payload (e.g. `{ acceptedTypes: ["application/json"] }`).
     *
     * @example
     * send.unsupportedMediaType("Only application/json payloads are accepted.");
     */
    public unsupportedMediaType: TSendPropsFn = (message, data) => {
        this.dispatch(
            "UNSUPPORTED_MEDIA_TYPE",
            "Unsupported Media Type",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **417 Expectation Failed** response.
     *
     * Use when the `Expect` request-header field could not be satisfied by
     * the server.
     *
     * @param message - Human-readable explanation of the unmet expectation.
     * @param data    - Optional payload.
     *
     * @example
     * send.expectationFailed("The 'Expect: 100-continue' header could not be satisfied.");
     */
    public expectationFailed: TSendPropsFn = (message, data) => {
        this.dispatch(
            "EXPECTATION_FAILED",
            "Expectation Failed",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **418 I'm a Teapot** response.
     *
     * An April Fools' joke defined in RFC 2324. Occasionally used as a
     * catch-all for intentionally refused requests (e.g. blocking bots).
     *
     * @param message - Whatever you want. The world is your teapot.
     * @param data    - Optional payload.
     *
     * @example
     * send.imATeapot("I refuse to brew coffee because I am, permanently, a teapot.");
     */
    public imATeapot: TSendPropsFn = (message, data) => {
        this.dispatch("IM_A_TEAPOT", "I'm a Teapot", false, message, data);
    };

    /**
     * Sends a **422 Unprocessable Entity** response.
     *
     * Use when the request is well-formed but contains semantic errors that
     * prevent it from being processed (e.g. domain validation failures,
     * business rule violations). Preferred over 400 for schema-valid but
     * logically invalid payloads.
     *
     * @param message - Human-readable explanation of why processing failed.
     * @param data    - Optional payload (e.g. structured validation errors per field).
     *
     * @example
     * send.unprocessableEntity("The 'birthDate' must be in the past.");
     * send.unprocessableEntity("Validation errors.", { fields: { age: "Must be ≥ 18" } });
     */
    public unprocessableEntity: TSendPropsFn = (message, data) => {
        this.dispatch(
            "UNPROCESSABLE_ENTITY",
            "Unprocessable Entity",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **423 Locked** response.
     *
     * Use when the resource being accessed is locked (e.g. being edited by
     * another user, or under an administrative hold).
     *
     * @param message - Human-readable explanation of why the resource is locked.
     * @param data    - Optional payload (e.g. lock owner, estimated unlock time).
     *
     * @example
     * send.locked("This document is currently being edited by another user.");
     * send.locked("Resource is locked.", { lockedBy: "alice@example.com", until: "2025-06-01T12:00:00Z" });
     */
    public locked: TSendPropsFn = (message, data) => {
        this.dispatch("LOCKED", "Locked", false, message, data);
    };

    /**
     * Sends a **429 Too Many Requests** response.
     *
     * Use when the client has exceeded an allowed request rate or quota.
     * Consider pairing this with a `Retry-After` header at the middleware level.
     *
     * @param message - Human-readable explanation of the rate limit breach.
     * @param data    - Optional payload (e.g. retry delay, remaining quota).
     *
     * @example
     * send.tooManyRequest("Rate limit reached. Try again in 60 seconds.");
     * send.tooManyRequest("Quota exceeded.", { retryAfter: 60 });
     */
    public tooManyRequest: TSendPropsFn = (message, data) => {
        this.dispatch(
            "TOO_MANY_REQUEST",
            "Too Many Requests",
            false,
            message,
            data,
        );
    };

    // =========================================================================
    // 5xx — Server Errors
    // =========================================================================

    /**
     * Sends a **500 Internal Server Error** response.
     *
     * Use for unexpected, unhandled server-side failures.
     * Avoid leaking internal stack traces or sensitive details in the message.
     *
     * @param message - Human-readable explanation safe to expose to the client.
     * @param data    - Optional payload (use sparingly — never expose raw stack traces).
     *
     * @example
     * send.internalError("An unexpected error occurred. Please try again later.");
     */
    public internalError: TSendPropsFn = (message, data) => {
        this.dispatch(
            "INTERNAL_SERVER_ERR",
            "Internal Server Error",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **501 Not Implemented** response.
     *
     * Use when the server does not support the functionality required to
     * fulfil the request (e.g. an HTTP method that is recognised but not
     * implemented on this server, or a feature under development).
     *
     * @param message - Human-readable explanation of what is not implemented.
     * @param data    - Optional payload (e.g. planned availability date).
     *
     * @example
     * send.notImplemented("The PATCH method is not yet supported on this resource.");
     */
    public notImplemented: TSendPropsFn = (message, data) => {
        this.dispatch(
            "NOT_IMPLEMENTED",
            "Not Implemented",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **502 Bad Gateway** response.
     *
     * Use when this server, acting as a gateway or proxy, received an invalid
     * response from an upstream server.
     *
     * @param message - Human-readable explanation safe to expose to the client.
     * @param data    - Optional payload (e.g. upstream service identifier).
     *
     * @example
     * send.badGateway("The payment provider returned an unexpected response.");
     */
    public badGateway: TSendPropsFn = (message, data) => {
        this.dispatch("BAD_GATEWAY", "Bad Gateway", false, message, data);
    };
 
    /**
     * Sends a **503 Service Unavailable** response.
     *
     * Use when the server is temporarily unable to handle the request due to
     * maintenance, overload, or a dependency outage. Pair with a
     * `Retry-After` header when the downtime window is known.
     *
     * @param message - Human-readable explanation including estimated recovery time when available.
     * @param data    - Optional payload (e.g. `{ retryAfter: "2025-06-01T06:00:00Z" }`).
     *
     * @example
     * send.serviceUnavailable("Scheduled maintenance until 06:00 UTC.");
     * send.serviceUnavailable("Server overloaded.", { retryAfter: "2025-06-01T06:00:00Z" });
     */
    public serviceUnavailable: TSendPropsFn = (message, data) => {
        this.dispatch(
            "SERVICE_UNAVAILABLE",
            "Service Unavailable",
            false,
            message,
            data,
        );
    };

    /**
     * Sends a **504 Gateway Timeout** response.
     *
     * Use when this server, acting as a gateway or proxy, did not receive a
     * timely response from an upstream server.
     *
     * @param message - Human-readable explanation of which upstream timed out.
     * @param data    - Optional payload (e.g. upstream service name, timeout duration).
     *
     * @example
     * send.gatewayTimeout("The database did not respond within the allowed time.");
     * send.gatewayTimeout("Upstream timeout.", { service: "payments-api", timeoutMs: 5000 });
     */
    public gatewayTimeout: TSendPropsFn = (message, data) => {
        this.dispatch(
            "GATEWAY_TIMEOUT",
            "Gateway Timeout",
            false,
            message,
            data,
        );
    };
}


/**
 * @file Send.ts
 * @description Structured HTTP error response helper for the XyPriss framework.
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
import { XyPrisResponse } from "xypriss";

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////SEND//////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////



// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * All HTTP status keys supported by the `Send` helper.
 * Each key maps to a standard HTTP status code.
 */
export type SupportedStatus =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "TOO_MANY_REQUEST"
  | "INTERNAL_SERVER_ERR";

/**
 * Maps every {@link SupportedStatus} key to its corresponding HTTP status code.
 */
export type ISeConfigs = Record<SupportedStatus, number>;

/**
 * Signature shared by all public error-dispatch methods.
 *
 * @param message - Human-readable description of the error shown to the API consumer.
 * @param data    - Optional payload to attach to the response body (e.g. validation details).
 */
export type TSendPropsFn = (message?: string, data?: unknown) => void;

/**
 * Contract that the {@link Send} class must satisfy.
 * Ensures every supported error type exposes a consistent public API.
 */
export interface ISeResponder {
  badRequest: TSendPropsFn;
  notFound: TSendPropsFn;
  tooManyRequest: TSendPropsFn;
  internalError: TSendPropsFn;
}

/**
 * Shape of every JSON response body produced by this helper.
 *
 * @property success    - Always `false` for error responses.
 * @property message    - Human-readable summary of the error.
 * @property serverName - Identifier of the server that handled the request.
 * @property data       - Optional payload (echoed from the caller when relevant).
 * @property details    - Machine-readable error metadata.
 */
export interface IResTemplate {
  success: false;
  message: string;
  serverName: string;
  data?: unknown;
  details: {
    /** Short error label (e.g. `"Bad Request"`). */
    error: string;
    /** Compact error code derived from the status key (e.g. `"EBADR"`). */
    errorCode: string;
    /** The HTTP status code that was sent. */
    statusCode: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a compact, uppercase error code from a {@link SupportedStatus} key.
 *
 * @example
 * buildErrorCode("BAD_REQUEST")      // → "EBADR"
 * buildErrorCode("INTERNAL_SERVER_ERR") // → "EINTE"
 *
 * @param status - The status key to convert.
 * @returns A 5-character string starting with `"E"`.
 */
function buildErrorCode(status: SupportedStatus): string {
  // Remove all underscores, take first 4 chars, prepend "E"
  return "E" + status.replace(/_/g, "").slice(0, 4).toUpperCase();
}

// ---------------------------------------------------------------------------
// Default HTTP status code registry
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS: ISeConfigs = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  TOO_MANY_REQUEST: 429,
  INTERNAL_SERVER_ERR: 500,
};

// ---------------------------------------------------------------------------
// Send class
// ---------------------------------------------------------------------------

/**
 * A structured HTTP response helper that standardises all error responses
 * across the application.
 *
 * Every method sends a JSON body conforming to {@link IResTemplate}, ensuring
 * consistent error shapes for API consumers regardless of where the error
 * originates.
 *
 * @example
 * ```ts
 * const send = new Send(res);
 *
 * // 400 – validation failure
 * send.badRequest("The 'email' field is required.");
 *
 * // 404 – resource missing
 * send.notFound("User not found.", { userId: 42 });
 * 
 * // 429 – rate limit exceeded
 * send.tooManyRequest("Too many requests. Please slow down.");
 *
 * // 500 – unexpected failure
 * send.internalError("An unexpected error occurred.");
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
   * @param configs - Optional override for the default status-code registry.
   *                  Useful for non-standard or custom HTTP codes.
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
   * @param errorLabel - Human-readable short label for the error type.
   * @param message    - Optional caller-supplied message; falls back to `errorLabel`.
   * @param data       - Optional payload to attach to the response body.
   */
  private dispatch(
    statusKey: SupportedStatus,
    errorLabel: string,
    message?: string,
    data?: unknown,
  ): void {
    const statusCode = this.configs[statusKey];

    const body: IResTemplate = {
      success: false,
      message: message ?? errorLabel,
      serverName: this.includeServerName
        ? this.serverName
        : (undefined as unknown as any),
      ...(data !== undefined && { data }),
      details: {
        error: errorLabel,
        errorCode: buildErrorCode(statusKey),
        statusCode,
      },
    };

    this.res.status(statusCode).json(body);
  }

  // -------------------------------------------------------------------------
  // Public methods
  // -------------------------------------------------------------------------

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
    this.dispatch("BAD_REQUEST", "Bad Request", message, data);
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
    this.dispatch("NOT_FOUND", "Not Found", message, data);
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
    this.dispatch("TOO_MANY_REQUEST", "Too Many Requests", message, data);
  };

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
      message,
      data,
    );
  };
}



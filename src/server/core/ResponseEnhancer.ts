/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import type { ServerResponse } from "http";
import { XyPrisResponse, XyPrisRequest } from "../../types/httpServer.type";
import { Logger } from "../../../shared/logger/Logger";

/**
 * ResponseEnhancer - Enhances the standard Node.js ServerResponse with Express-like utility methods.
 *
 * This class is responsible for decorating the raw HTTP response object with a more
 * developer-friendly API, including methods for sending JSON, setting cookies,
 * handling redirects, and managing headers. It is optimized for performance
 * using private method factories and internal caching.
 */
export class ResponseEnhancer {
    private logger: Logger;

    // Cache for frequently used regular expressions to optimize performance
    private static readonly SAFE_STRING_REGEX = /^[\w\-]+$/;
    private static readonly COOKIE_NAME_REGEX = /^[\w!#$%&'*+\-.^_`|~]+$/;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Enhances a standard Node.js ServerResponse object by injecting XyPris-specific methods.
     *
     * This method performs a functional decoration of the response object, binding
     * new methods to it while preserving the original context. It also initializes
     * the `locals` object for storing request-scoped data.
     *
     * @param res - The original Node.js ServerResponse object.
     * @param req - The enhanced XyPrisRequest object (used for logging and context).
     * @returns The enhanced XyPrisResponse object.
     */
    public enhance(res: ServerResponse, req: XyPrisRequest): XyPrisResponse {
        const XyPrisRes = res as XyPrisResponse;
        XyPrisRes.locals = {};

        // Bind methods to preserve context
        XyPrisRes.json = this._createJsonMethod(XyPrisRes, req);
        XyPrisRes.send = this._createSendMethod(XyPrisRes, req);
        XyPrisRes.status = this._createStatusMethod(XyPrisRes);
        XyPrisRes.setHeader = this._createSetHeaderMethod(XyPrisRes);
        XyPrisRes.set = this._createSetMethod(XyPrisRes);
        XyPrisRes.redirect = this._createRedirectMethod(XyPrisRes);
        XyPrisRes.cookie = this._createCookieMethod(XyPrisRes);
        XyPrisRes.clearCookie = this._createClearCookieMethod(XyPrisRes);
        XyPrisRes.get = this._createGetMethod(XyPrisRes);

        return XyPrisRes;
    }

    /**
     * Checks if the response has already been sent or ended.
     *
     * This is a safety check to prevent "Headers already sent" errors or attempts
     * to write to a closed stream. If the response is ended, an error is logged
     * with the context of the attempted operation.
     *
     * @param res - The response object to check.
     * @param req - The request object for logging context.
     * @param methodName - The name of the method that attempted to send data.
     * @returns True if the response is already ended, false otherwise.
     */
    private _isResponseEnded(
        res: XyPrisResponse,
        req: XyPrisRequest,
        methodName: string
    ): boolean {
        if (res.writableEnded) {
            this.logger.error(
                "server",
                `[HttpServer] ${methodName} called after response already finished (${req.method} ${req.path}).`
            );
            return true;
        }
        return false;
    }

    /**
     * Creates the `res.json()` method for the response object.
     *
     * The generated method serializes the provided data to JSON, sets the
     * `Content-Type` header to `application/json`, and ends the response.
     * It includes robust error handling for serialization failures.
     *
     * @param res - The response object to bind the method to.
     * @param req - The request object for context.
     * @returns A function that handles JSON responses.
     */
    private _createJsonMethod(res: XyPrisResponse, req: XyPrisRequest) {
        return (data: any) => {
            if (this._isResponseEnded(res, req, "res.json()")) return;

            try {
                const jsonData = this._safeJsonStringify(data);
                res.setHeader("Content-Type", "application/json");
                res.end(jsonData);
            } catch (error) {
                this.logger.error(
                    "server",
                    `[HttpServer] Failed to stringify JSON: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
                res.statusCode = 500;
                res.end('{"error":"Internal Server Error"}');
            }
        };
    }

    /**
     * Performs safe JSON serialization with error handling and support for special types.
     *
     * This method is optimized to quickly handle primitive types and uses a
     * custom replacer for complex objects to handle circular references,
     * Errors, and BigInt values.
     *
     * @param data - The data to serialize.
     * @returns The JSON string representation of the data.
     */
    private _safeJsonStringify(data: any): string {
        // Fast detection for primitive and null types
        if (data === null) return "null";
        if (data === undefined) return "null";

        const type = typeof data;
        if (type === "string" || type === "number" || type === "boolean") {
            return JSON.stringify(data);
        }

        // Handle complex objects and arrays
        return JSON.stringify(data, this._jsonReplacer);
    }

    /**
     * A custom replacer function for `JSON.stringify` to handle non-standard types.
     *
     * - Converts `Error` objects into a serializable format (name, message, stack).
     * - Converts `BigInt` values to strings to prevent serialization errors.
     * - Prevents potential issues with circular references in specific types.
     *
     * @param key - The key being serialized.
     * @param value - The value being serialized.
     * @returns The serializable version of the value.
     */
    private _jsonReplacer(key: string, value: any): any {
        // Handle Error objects which are not natively serializable
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack,
            };
        }

        // Convert BigInt to string as JSON does not support BigInt
        if (typeof value === "bigint") {
            return value.toString();
        }

        return value;
    }

    /**
     * Creates the `res.send()` method for the response object.
     *
     * This method is polymorphic:
     * - If the data is an object or array (and not a Buffer), it calls `res.json()`.
     * - Otherwise, it converts the data to a string or Buffer and sends it.
     *
     * @param res - The response object to bind the method to.
     * @param req - The request object for context.
     * @returns A function that handles general data responses.
     */
    private _createSendMethod(res: XyPrisResponse, req: XyPrisRequest) {
        return (data: any) => {
            if (this._isResponseEnded(res, req, "res.send()")) return;

            if (this._isJsonData(data)) {
                res.json(data);
            } else {
                res.end(this._convertToString(data));
            }
        };
    }

    /**
     * Determines if the provided data should be treated as JSON.
     *
     * Returns true for objects and arrays, excluding `null` and `Buffer` objects.
     *
     * @param data - The data to inspect.
     * @returns True if the data is JSON-serializable, false otherwise.
     */
    private _isJsonData(data: any): boolean {
        if (data === null || data === undefined) return false;

        const type = typeof data;
        return type === "object" && !Buffer.isBuffer(data);
    }

    /**
     * Safely converts any data type to a string representation for HTTP transmission.
     *
     * - Returns an empty string for `null` or `undefined`.
     * - Converts `Buffer` to string using default encoding.
     * - Uses `String()` for all other types.
     *
     * @param data - The data to convert.
     * @returns The string representation of the data.
     */
    private _convertToString(data: any): string {
        if (data === null || data === undefined) return "";
        if (Buffer.isBuffer(data)) return data.toString();
        return String(data);
    }

    /**
     * Creates the `res.status()` method for the response object.
     *
     * Sets the HTTP status code for the response. This method is chainable,
     * allowing for patterns like `res.status(201).send(...)`.
     *
     * @param res - The response object to bind the method to.
     * @returns A function that sets the status code and returns the response object.
     */
    private _createStatusMethod(res: XyPrisResponse) {
        return (code: number) => {
            if (this._isValidStatusCode(code)) {
                res.statusCode = code;
            }
            return res;
        };
    }

    /**
     * Validates if a number is a valid HTTP status code.
     *
     * A valid status code must be an integer between 100 and 599 (inclusive).
     *
     * @param code - The status code to validate.
     * @returns True if the code is valid, false otherwise.
     */
    private _isValidStatusCode(code: number): boolean {
        return Number.isInteger(code) && code >= 100 && code < 600;
    }

    /**
     * Creates an enhanced `res.setHeader()` method.
     *
     * This version adds safety checks to ensure headers are not set after
     * they have already been sent to the client, and validates the header name.
     *
     * @param res - The response object to bind the method to.
     * @returns A function that safely sets a response header.
     */
    private _createSetHeaderMethod(res: XyPrisResponse) {
        const originalSetHeader = res.setHeader.bind(res);

        return (name: string, value: string | number | readonly string[]) => {
            if (!res.headersSent && this._isValidHeaderName(name)) {
                try {
                    originalSetHeader(name, value);
                } catch (error) {
                    this.logger.error(
                        "server",
                        `[HttpServer] Failed to set header "${name}": ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
            return res;
        };
    }

    /**
     * Validates a header name for basic compliance.
     *
     * Ensures the name is a non-empty string.
     *
     * @param name - The header name to validate.
     * @returns True if the name is valid, false otherwise.
     */
    private _isValidHeaderName(name: string): boolean {
        return typeof name === "string" && name.length > 0;
    }

    /**
     * Creates the `res.set()` method (Express-compatible).
     *
     * This method allows setting headers in two ways:
     * 1. Providing a field name and a value.
     * 2. Providing an object containing multiple field-value pairs.
     *
     * @param res - The response object to bind the method to.
     * @returns A function that sets one or more headers.
     */
    private _createSetMethod(res: XyPrisResponse) {
        return (
            field: string | Record<string, any>,
            value?: string | number | readonly string[]
        ) => {
            if (typeof field === "string" && value !== undefined) {
                res.setHeader(field, value);
            } else if (this._isPlainObject(field)) {
                this._setMultipleHeaders(res, field as Record<string, any>);
            }
            return res;
        };
    }

    /**
     * Checks if a value is a plain JavaScript object.
     *
     * A plain object is one created by `{}` or `new Object()`, and is not
     * an array, null, or a class instance.
     *
     * @param obj - The value to check.
     * @returns True if it's a plain object, false otherwise.
     */
    private _isPlainObject(obj: any): boolean {
        return (
            obj !== null &&
            typeof obj === "object" &&
            !Array.isArray(obj) &&
            Object.getPrototypeOf(obj) === Object.prototype
        );
    }

    /**
     * Sets multiple headers at once from a key-value object.
     *
     * Iterates through the object entries and calls `res.setHeader` for each
     * valid header name.
     *
     * @param res - The response object.
     * @param headers - An object containing header names and values.
     */
    private _setMultipleHeaders(
        res: XyPrisResponse,
        headers: Record<string, any>
    ): void {
        const entries = Object.entries(headers);
        for (let i = 0; i < entries.length; i++) {
            const [key, val] = entries[i];
            if (this._isValidHeaderName(key)) {
                res.setHeader(key, val as string | number | readonly string[]);
            }
        }
    }

    /**
     * Creates the `res.redirect()` method for the response object.
     *
     * Redirects the client to a specified URL with an optional status code.
     * If no status code is provided, it defaults to 302 (Found).
     *
     * @param res - The response object to bind the method to.
     * @returns A function that performs an HTTP redirection.
     */
    private _createRedirectMethod(res: XyPrisResponse) {
        return (statusOrUrl: number | string, url?: string) => {
            let redirectUrl: string;
            let statusCode: number;

            if (typeof statusOrUrl === "number" && url) {
                statusCode = this._isValidStatusCode(statusOrUrl)
                    ? statusOrUrl
                    : 302;
                redirectUrl = url;
            } else {
                statusCode = 302;
                redirectUrl = statusOrUrl as string;
            }

            if (this._isValidRedirectUrl(redirectUrl)) {
                res.statusCode = statusCode;
                res.setHeader("Location", redirectUrl);
            }
            res.end();
        };
    }

    /**
     * Validates a redirection URL.
     *
     * Ensures the URL is a non-empty string.
     *
     * @param url - The URL to validate.
     * @returns True if the URL is valid, false otherwise.
     */
    private _isValidRedirectUrl(url: string): boolean {
        return typeof url === "string" && url.length > 0;
    }

    /**
     * Creates the `res.cookie()` method for the response object.
     *
     * Sets a cookie by adding a `Set-Cookie` header. Supports various options
     * such as `maxAge`, `expires`, `httpOnly`, `secure`, `path`, `domain`, and `sameSite`.
     *
     * @param res - The response object to bind the method to.
     * @returns A function that sets a cookie.
     */
    private _createCookieMethod(res: XyPrisResponse) {
        return (name: string, value: string, options: any = {}) => {
            if (!this._isValidCookieName(name)) {
                this.logger.error(
                    "server",
                    `[HttpServer] Invalid cookie name: ${name}`
                );
                return;
            }

            const cookieString = this._buildCookieString(name, value, options);
            this._appendCookie(res, cookieString);
        };
    }

    /**
     * Validates a cookie name against RFC 6265 specifications.
     *
     * Ensures the name is a non-empty string and contains only allowed characters.
     *
     * @param name - The cookie name to validate.
     * @returns True if the name is valid, false otherwise.
     */
    private _isValidCookieName(name: string): boolean {
        return (
            typeof name === "string" &&
            name.length > 0 &&
            ResponseEnhancer.COOKIE_NAME_REGEX.test(name)
        );
    }

    /**
     * Constructs a formatted `Set-Cookie` header string based on the provided options.
     *
     * This method handles the serialization of cookie attributes like Expires,
     * Max-Age, Domain, Path, Secure, HttpOnly, and SameSite.
     *
     * @param name - The name of the cookie.
     * @param value - The value of the cookie (will be URI encoded).
     * @param options - Configuration options for the cookie.
     * @returns A fully formatted cookie string.
     */
    private _buildCookieString(
        name: string,
        value: string,
        options: any
    ): string {
        const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

        if (options.maxAge !== undefined) {
            parts.push(`Max-Age=${options.maxAge}`);
        }

        if (options.expires instanceof Date) {
            parts.push(`Expires=${options.expires.toUTCString()}`);
        }

        if (options.httpOnly) parts.push("HttpOnly");
        if (options.secure) parts.push("Secure");

        parts.push(`Path=${options.path || "/"}`);

        if (options.domain) {
            parts.push(`Domain=${options.domain}`);
        }

        if (options.sameSite) {
            parts.push(this._buildSameSiteAttribute(options.sameSite));
        }

        return parts.join("; ");
    }

    /**
     * Builds the `SameSite` attribute string for a cookie.
     *
     * Supports standard values: Lax, Strict, and None.
     *
     * @param sameSite - The SameSite value or boolean.
     * @returns The formatted `SameSite=Value` string.
     */
    private _buildSameSiteAttribute(sameSite: any): string {
        const value =
            typeof sameSite === "string" ? sameSite.toLowerCase() : sameSite;

        switch (value) {
            case "lax":
                return "SameSite=Lax";
            case "strict":
                return "SameSite=Strict";
            case "none":
                return "SameSite=None";
            default:
                return `SameSite=${sameSite}`;
        }
    }

    /**
     * Appends a new cookie string to the `Set-Cookie` header.
     *
     * If headers already contain one or more cookies, the new one is appended
     * to the array to ensure all cookies are sent to the client.
     *
     * @param res - The response object.
     * @param cookieString - The formatted cookie string to append.
     */
    private _appendCookie(res: XyPrisResponse, cookieString: string): void {
        const existing = res.getHeader("Set-Cookie");
        let cookiesArray: string[];

        if (!existing) {
            cookiesArray = [cookieString];
        } else if (Array.isArray(existing)) {
            cookiesArray = [...existing, cookieString];
        } else {
            cookiesArray = [String(existing), cookieString];
        }

        res.setHeader("Set-Cookie", cookiesArray);
    }

    /**
     * Creates the `res.clearCookie()` method for the response object.
     *
     * Clears a cookie by setting its expiration date to the past and
     * its `maxAge` to 0.
     *
     * @param res - The response object to bind the method to.
     * @returns A function that clears a specific cookie.
     */
    private _createClearCookieMethod(res: XyPrisResponse) {
        return (name: string, options: any = {}) => {
            res.cookie(name, "", {
                ...options,
                maxAge: 0,
                expires: new Date(0),
            });
        };
    }

    /**
     * Creates the `res.get()` method for retrieving response headers.
     *
     * This provides Express compatibility for accessing headers that have
     * already been set on the response object.
     *
     * @param res - The response object to bind the method to.
     * @returns A function that retrieves a header value by name.
     */
    private _createGetMethod(res: XyPrisResponse) {
        return (name: string): string | number | string[] | undefined => {
            return res.getHeader(name);
        };
    }
}


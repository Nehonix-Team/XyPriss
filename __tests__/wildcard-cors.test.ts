/**
 * Tests for wildcard CORS functionality
 */

import { matchesWildcardPattern, isOriginAllowed, createWildcardOriginFunction } from "../src/server/utils/wildcardMatcher";

describe("Wildcard CORS Functionality", () => {
    describe("matchesWildcardPattern", () => {
        test("should match localhost with port wildcard", () => {
            expect(matchesWildcardPattern("http://localhost:3000", "localhost:*")).toBe(true);
            expect(matchesWildcardPattern("http://localhost:8080", "localhost:*")).toBe(true);
            expect(matchesWildcardPattern("https://localhost:443", "localhost:*")).toBe(true);
        });

        test("should match 127.0.0.1 with port wildcard", () => {
            expect(matchesWildcardPattern("http://127.0.0.1:3000", "127.0.0.1:*")).toBe(true);
            expect(matchesWildcardPattern("https://127.0.0.1:8080", "127.0.0.1:*")).toBe(true);
        });

        test("should match IPv6 localhost with port wildcard", () => {
            expect(matchesWildcardPattern("http://[::1]:3000", "::1:*")).toBe(true);
            expect(matchesWildcardPattern("https://[::1]:8080", "::1:*")).toBe(true);
        });

        test("should match subdomain wildcards", () => {
            expect(matchesWildcardPattern("https://api.test.com", "*.test.com")).toBe(true);
            expect(matchesWildcardPattern("https://app.test.com", "*.test.com")).toBe(true);
            expect(matchesWildcardPattern("https://admin.test.com", "*.test.com")).toBe(true);
        });

        test("should not match different domains", () => {
            expect(matchesWildcardPattern("http://example.com:3000", "localhost:*")).toBe(false);
            expect(matchesWildcardPattern("https://malicious.com", "*.test.com")).toBe(false);
        });

        test("should handle exact matches without wildcards", () => {
            expect(matchesWildcardPattern("https://example.com", "example.com")).toBe(true);
            expect(matchesWildcardPattern("https://example.com", "different.com")).toBe(false);
        });
    });

    describe("isOriginAllowed", () => {
        const allowedOrigins = ["localhost:*", "127.0.0.1:*", "::1:*", "*.test.com"];

        test("should allow origins matching wildcard patterns", () => {
            expect(isOriginAllowed("http://localhost:3000", allowedOrigins)).toBe(true);
            expect(isOriginAllowed("https://api.test.com", allowedOrigins)).toBe(true);
            expect(isOriginAllowed("http://127.0.0.1:8080", allowedOrigins)).toBe(true);
        });

        test("should reject origins not matching patterns", () => {
            expect(isOriginAllowed("https://malicious.com", allowedOrigins)).toBe(false);
            expect(isOriginAllowed("http://example.com", allowedOrigins)).toBe(false);
        });

        test("should handle empty or invalid inputs", () => {
            expect(isOriginAllowed("", allowedOrigins)).toBe(false);
            expect(isOriginAllowed("http://localhost:3000", [])).toBe(false);
        });
    });

    describe("createWildcardOriginFunction", () => {
        const allowedOrigins = ["localhost:*", "*.test.com"];
        const originFunction = createWildcardOriginFunction(allowedOrigins);

        test("should allow matching origins via callback", (done) => {
            originFunction("http://localhost:3000", (err, allowed) => {
                expect(err).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });

        test("should reject non-matching origins via callback", (done) => {
            originFunction("https://malicious.com", (err, allowed) => {
                expect(err).toBeNull();
                expect(allowed).toBe(false);
                done();
            });
        });

        test("should allow requests with no origin", (done) => {
            originFunction(undefined, (err, allowed) => {
                expect(err).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });
    });
});

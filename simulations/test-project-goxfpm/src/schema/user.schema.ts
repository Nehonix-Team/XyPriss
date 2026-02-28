/**
 * @fileoverview User validation schema powered by Reliant-Type.
 *
 * ## What is Reliant-Type?
 * Reliant-Type is a modern, high-performance schema validation library designed
 * to bring the clarity and familiarity of TypeScript interfaces to runtime validation.
 * It bridges the gap between static type checking and dynamic data validation,
 * ensuring that the data your application processes at runtime matches the
 * structures you've defined in code.
 *
 * ## Why use it?
 * - **Interface-Like Syntax**: Define schemas using a natural, string-based syntax (e.g., `email!`, `uuid`).
 * - **Runtime Type Safety**: Prevents malformed data from causing crashes or security vulnerabilities.
 * - **High Performance**: Optimized validation paths with internal caching and pre-compilation.
 * - **Developer Friendly**: Provides clear, descriptive error messages with precise property paths.
 *
 * This module defines the strict contract for User data, acting as a security
 * and integrity gate for any incoming user-related payloads.
 *
 * @see {@link https://github.com/Nehonix-Team/reliant-type | Official Repository & Documentation}
 */

import { Interface } from "reliant-type";

/**
 * The `userSchema` acts as the single source of truth for user data structure validation.
 *
 * ### Validation Features:
 * - **username**: Validates standard username formats.
 * - **email!**: Enforces a required, non-empty, and valid email address.
 * - **role**: A strict union type allowing only `'user'` or `'admin'`.
 * - **password**: Validates against secure password patterns to ensure complexity.
 *
 * This schema supports both synchronous and asynchronous validation and provides
 * full TypeScript inference for the validated data.
 *
 * @example
 * // Validating user input
 * const validation = userSchema.safeParse(payload);
 *
 * if (validation.success) {
 *   const user = validation.data; // Fully typed
 *   console.log("Successfully validated user:", user.username);
 * } else {
 *   console.error("Validation failed:", validation.errors);
 * }
 */
export const userSchema = Interface({
  username: "username",
  email: "email!",
  role: "user | admin",
  password: "password",
});

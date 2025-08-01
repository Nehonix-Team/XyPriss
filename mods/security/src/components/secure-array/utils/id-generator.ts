/***************************************************************************
 * XyPrissSecurity - Secure Array ID Generator
 *
 * This file contains the ID generation utility for SecureArray
 *
 * @author Nehonix
 *
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

import { NehoID } from "nehoid";

/**
 * ID generator utility for SecureArray instances
 */

/**
 * Generates unique IDs for SecureArray instances
 */
export class ArrayIdGenerator {
    private static counter: number = 0;
    private static readonly prefix: string = "f.arr.";

    /**
     * Generates a unique ID for a SecureArray instance
     */
    public static generate(): string {
        return NehoID.generate({ prefix: this.prefix, size: 10 });
    }

    /**
     * Validates if a string is a valid SecureArray ID
     */
    public static isValid(id: string): boolean {
        if (typeof id !== "string") {
            return false;
        }

        return (
            id.startsWith(this.prefix + "-") &&
            id.length > this.prefix.length + 1
        );
    }

    /**
     * Resets the counter (for testing purposes)
     */
    public static resetCounter(): void {
        this.counter = 0;
    }

    /**
     * Gets the current counter value
     */
    public static getCounter(): number {
        return this.counter;
    }

    /**
     * Gets the prefix used for IDs
     */
    public static getPrefix(): string {
        return this.prefix;
    }
}


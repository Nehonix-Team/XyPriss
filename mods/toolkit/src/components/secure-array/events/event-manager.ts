/***************************************************************************
 * XyPrissSecurity - Secure Array Event Manager
 *
 * This file contains the event management system for SecureArray
 *
 * @author Nehonix

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

/**
 * Event manager for SecureArray operations
 */

import { SecureArrayEvent, SecureArrayEventListener } from "../types";

/**
 * Manages events for SecureArray operations
 */
export class ArrayEventManager {
    private listeners: Map<SecureArrayEvent, Set<SecureArrayEventListener>> =
        new Map();
    private eventHistory: Array<{
        event: SecureArrayEvent;
        index?: number;
        value?: any;
        metadata?: any;
        timestamp: Date;
    }> = [];
    private maxHistorySize: number = 1000;

    /**
     * Adds an event listener
     */
    public on(
        event: SecureArrayEvent,
        listener: SecureArrayEventListener
    ): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
    }

    /**
     * Removes an event listener
     */
    public off(
        event: SecureArrayEvent,
        listener: SecureArrayEventListener
    ): boolean {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            return eventListeners.delete(listener);
        }
        return false;
    }

    /**
     * Removes all listeners for an event
     */
    public removeAllListeners(event?: SecureArrayEvent): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Emits an event to all listeners
     */
    public emit(
        event: SecureArrayEvent,
        index?: number,
        value?: any,
        metadata?: any
    ): void {
        // Add to history
        this.addToHistory(event, index, value, metadata);

        // Emit to listeners
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            for (const listener of eventListeners) {
                try {
                    const result = listener(event, index, value, metadata);
                    // Handle async listeners
                    if (result instanceof Promise) {
                        result.catch((error) => {
                            console.error(
                                `Error in async event listener for ${event}:`,
                                error
                            );
                        });
                    }
                } catch (error) {
                    console.error(
                        `Error in event listener for ${event}:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Adds an event to the history
     */
    private addToHistory(
        event: SecureArrayEvent,
        index?: number,
        value?: any,
        metadata?: any
    ): void {
        this.eventHistory.push({
            event,
            index,
            value: this.sanitizeValueForHistory(value),
            metadata,
            timestamp: new Date(),
        });

        // Trim history if it exceeds max size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Sanitizes sensitive values for history storage
     */
    private sanitizeValueForHistory(value: any): any {
        if (typeof value === "string" && value.length > 100) {
            return `[String: ${value.length} chars]`;
        }
        if (value instanceof Uint8Array) {
            return `[Uint8Array: ${value.length} bytes]`;
        }
        if (typeof value === "object" && value !== null) {
            return `[Object: ${value.constructor?.name || "Unknown"}]`;
        }
        return value;
    }

    /**
     * Gets the event history
     */
    public getHistory(limit?: number): Array<{
        event: SecureArrayEvent;
        index?: number;
        value?: any;
        metadata?: any;
        timestamp: Date;
    }> {
        if (limit) {
            return this.eventHistory.slice(-limit);
        }
        return [...this.eventHistory];
    }

    /**
     * Clears the event history
     */
    public clearHistory(): void {
        this.eventHistory = [];
    }

    /**
     * Sets the maximum history size
     */
    public setMaxHistorySize(size: number): void {
        this.maxHistorySize = Math.max(0, size);

        // Trim current history if necessary
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Gets statistics about events
     */
    public getEventStats(): {
        totalEvents: number;
        eventCounts: Map<SecureArrayEvent, number>;
        recentEvents: number;
        listenerCounts: Map<SecureArrayEvent, number>;
    } {
        const eventCounts = new Map<SecureArrayEvent, number>();
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        let recentEvents = 0;

        // Count events in history
        for (const historyItem of this.eventHistory) {
            const count = eventCounts.get(historyItem.event) || 0;
            eventCounts.set(historyItem.event, count + 1);

            if (historyItem.timestamp > oneHourAgo) {
                recentEvents++;
            }
        }

        // Count listeners
        const listenerCounts = new Map<SecureArrayEvent, number>();
        for (const [event, listeners] of this.listeners.entries()) {
            listenerCounts.set(event, listeners.size);
        }

        return {
            totalEvents: this.eventHistory.length,
            eventCounts,
            recentEvents,
            listenerCounts,
        };
    }

    /**
     * Gets events by type
     */
    public getEventsByType(
        event: SecureArrayEvent,
        limit?: number
    ): Array<{
        index?: number;
        value?: any;
        metadata?: any;
        timestamp: Date;
    }> {
        const filtered = this.eventHistory
            .filter((item) => item.event === event)
            .map((item) => ({
                index: item.index,
                value: item.value,
                metadata: item.metadata,
                timestamp: item.timestamp,
            }));

        if (limit) {
            return filtered.slice(-limit);
        }
        return filtered;
    }

    /**
     * Gets events within a time range
     */
    public getEventsInTimeRange(
        startTime: Date,
        endTime: Date
    ): Array<{
        event: SecureArrayEvent;
        index?: number;
        value?: any;
        metadata?: any;
        timestamp: Date;
    }> {
        return this.eventHistory.filter(
            (item) => item.timestamp >= startTime && item.timestamp <= endTime
        );
    }

    /**
     * Checks if there are any listeners for an event
     */
    public hasListeners(event: SecureArrayEvent): boolean {
        const eventListeners = this.listeners.get(event);
        return eventListeners ? eventListeners.size > 0 : false;
    }

    /**
     * Gets the number of listeners for an event
     */
    public getListenerCount(event: SecureArrayEvent): number {
        const eventListeners = this.listeners.get(event);
        return eventListeners ? eventListeners.size : 0;
    }

    /**
     * Gets all registered events
     */
    public getRegisteredEvents(): SecureArrayEvent[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * Clears all listeners and history
     */
    public clear(): void {
        this.listeners.clear();
        this.eventHistory = [];
    }

    /**
     * Creates a one-time listener that removes itself after being called
     */
    public once(
        event: SecureArrayEvent,
        listener: SecureArrayEventListener
    ): void {
        const onceListener: SecureArrayEventListener = (
            evt,
            index,
            value,
            metadata
        ) => {
            this.off(event, onceListener);
            return listener(evt, index, value, metadata);
        };
        this.on(event, onceListener);
    }

    /**
     * Emits an event and waits for all async listeners to complete
     */
    public async emitAsync(
        event: SecureArrayEvent,
        index?: number,
        value?: any,
        metadata?: any
    ): Promise<void> {
        // Add to history
        this.addToHistory(event, index, value, metadata);

        // Emit to listeners and collect promises
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const promises: Promise<void>[] = [];

            for (const listener of eventListeners) {
                try {
                    const result = listener(event, index, value, metadata);
                    if (result instanceof Promise) {
                        promises.push(result);
                    }
                } catch (error) {
                    console.error(
                        `Error in event listener for ${event}:`,
                        error
                    );
                }
            }

            // Wait for all async listeners to complete
            if (promises.length > 0) {
                await Promise.allSettled(promises);
            }
        }
    }
}


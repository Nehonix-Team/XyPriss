/**
 * Event Manager Module
 * Handles event system for SecureObject
 */

import { SecureObjectEvent, EventListener } from "../types";

/**
 * Manages events for SecureObject instances
 */
export class EventManager {
    private eventListeners: Map<SecureObjectEvent, Set<EventListener>> =
        new Map();

    /**
     * Adds an event listener
     */
    addEventListener(event: SecureObjectEvent, listener: EventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(listener);
    }

    /**
     * Removes an event listener
     */
    removeEventListener(
        event: SecureObjectEvent,
        listener: EventListener
    ): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(listener);

            // Clean up empty sets
            if (listeners.size === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    /**
     * Removes all listeners for a specific event
     */
    removeAllListeners(event?: SecureObjectEvent): void {
        if (event) {
            this.eventListeners.delete(event);
        } else {
            this.eventListeners.clear();
        }
    }

    /**
     * Emits an event to all registered listeners
     */
    emit(event: SecureObjectEvent, key?: string, value?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(event, key, value);
                } catch (error) {
                    console.error(
                        `Error in SecureObject event listener:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Gets the number of listeners for an event
     */
    getListenerCount(event: SecureObjectEvent): number {
        const listeners = this.eventListeners.get(event);
        return listeners ? listeners.size : 0;
    }

    /**
     * Gets all registered event types
     */
    getRegisteredEvents(): SecureObjectEvent[] {
        return Array.from(this.eventListeners.keys());
    }

    /**
     * Gets total number of listeners across all events
     */
    getTotalListenerCount(): number {
        let total = 0;
        for (const listeners of this.eventListeners.values()) {
            total += listeners.size;
        }
        return total;
    }

    /**
     * Checks if there are any listeners for an event
     */
    hasListeners(event: SecureObjectEvent): boolean {
        const listeners = this.eventListeners.get(event);
        return listeners ? listeners.size > 0 : false;
    }

    /**
     * Checks if there are any listeners at all
     */
    hasAnyListeners(): boolean {
        return this.eventListeners.size > 0;
    }

    /**
     * Gets a copy of all listeners for an event
     */
    getListeners(event: SecureObjectEvent): EventListener[] {
        const listeners = this.eventListeners.get(event);
        return listeners ? Array.from(listeners) : [];
    }

    /**
     * Creates a one-time event listener that removes itself after first execution
     */
    once(event: SecureObjectEvent, listener: EventListener): void {
        const onceListener: EventListener = (evt, key, value) => {
            this.removeEventListener(event, onceListener);
            listener(evt, key, value);
        };

        this.addEventListener(event, onceListener);
    }

    /**
     * Creates a promise that resolves when a specific event is emitted
     */
    waitFor(
        event: SecureObjectEvent,
        timeout?: number
    ): Promise<{ key?: string; value?: any }> {
        return new Promise((resolve, reject) => {
            let timeoutId: NodeJS.Timeout | undefined;

            const listener: EventListener = (_evt, key, value) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                this.removeEventListener(event, listener);
                resolve({ key, value });
            };

            this.addEventListener(event, listener);

            if (timeout) {
                timeoutId = setTimeout(() => {
                    this.removeEventListener(event, listener);
                    reject(
                        new Error(`Event '${event}' timeout after ${timeout}ms`)
                    );
                }, timeout);
            }
        });
    }

    /**
     * Emits an event and waits for all listeners to complete (if they return promises)
     */
    async emitAsync(
        event: SecureObjectEvent,
        key?: string,
        value?: any
    ): Promise<void> {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const promises: Promise<any>[] = [];

            for (const listener of listeners) {
                try {
                    const result = listener(event, key, value);
                    if (
                        result &&
                        typeof result === "object" &&
                        "then" in result
                    ) {
                        promises.push(result as Promise<void>);
                    }
                } catch (error) {
                    console.error(
                        `Error in SecureObject event listener:`,
                        error
                    );
                }
            }

            if (promises.length > 0) {
                await Promise.allSettled(promises);
            }
        }
    }

    /**
     * Creates a filtered event listener that only triggers for specific keys
     */
    addKeyFilteredListener(
        event: SecureObjectEvent,
        keys: string[],
        listener: EventListener
    ): void {
        const filteredListener: EventListener = (evt, key, value) => {
            if (!key || keys.includes(key)) {
                listener(evt, key, value);
            }
        };

        this.addEventListener(event, filteredListener);
    }

    /**
     * Clears all event listeners (used during destruction)
     */
    clear(): void {
        this.eventListeners.clear();
    }

    /**
     * Gets debug information about the event system
     */
    getDebugInfo(): {
        totalEvents: number;
        totalListeners: number;
        eventBreakdown: Record<SecureObjectEvent, number>;
    } {
        const eventBreakdown: Record<string, number> = {};

        for (const [event, listeners] of this.eventListeners.entries()) {
            eventBreakdown[event] = listeners.size;
        }

        return {
            totalEvents: this.eventListeners.size,
            totalListeners: this.getTotalListenerCount(),
            eventBreakdown: eventBreakdown as Record<SecureObjectEvent, number>,
        };
    }
}


/**
 * Memory Event Manager
 * 
 * Handles all memory-related events with filtering, history, and error handling
 */

import {
    MemoryEvent,
    MemoryEventType,
    MemoryEventListener,
    MemoryManagerConfig
} from './types';

/**
 * Event filter function type
 */
export type EventFilter = (event: MemoryEvent) => boolean;

/**
 * Event manager for memory events with advanced features
 */
export class MemoryEventManager {
    private listeners = new Map<MemoryEventType, Set<MemoryEventListener>>();
    private eventHistory: MemoryEvent[] = [];
    private maxHistorySize: number;
    private filters = new Set<EventFilter>();
    private isEnabled = true;
    private eventCounts = new Map<MemoryEventType, number>();

    constructor(config: MemoryManagerConfig) {
        this.maxHistorySize = config.maxEventHistory;
    }

    /**
     * Add event listener
     */
    on(type: MemoryEventType, listener: MemoryEventListener): void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);
    }

    /**
     * Add event listener for multiple types
     */
    onMultiple(types: MemoryEventType[], listener: MemoryEventListener): void {
        types.forEach(type => this.on(type, listener));
    }

    /**
     * Add one-time event listener
     */
    once(type: MemoryEventType, listener: MemoryEventListener): void {
        const onceWrapper = (event: MemoryEvent) => {
            listener(event);
            this.off(type, onceWrapper);
        };
        this.on(type, onceWrapper);
    }

    /**
     * Remove event listener
     */
    off(type: MemoryEventType, listener: MemoryEventListener): void {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.listeners.delete(type);
            }
        }
    }

    /**
     * Remove all listeners for a type
     */
    removeAllListeners(type?: MemoryEventType): void {
        if (type) {
            this.listeners.delete(type);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Add event filter
     */
    addFilter(filter: EventFilter): void {
        this.filters.add(filter);
    }

    /**
     * Remove event filter
     */
    removeFilter(filter: EventFilter): void {
        this.filters.delete(filter);
    }

    /**
     * Clear all filters
     */
    clearFilters(): void {
        this.filters.clear();
    }

    /**
     * Enable/disable event manager
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Check if event passes all filters
     */
    private passesFilters(event: MemoryEvent): boolean {
        for (const filter of this.filters) {
            try {
                if (!filter(event)) {
                    return false;
                }
            } catch (error) {
                console.error('Error in event filter:', error);
                // Continue with other filters
            }
        }
        return true;
    }

    /**
     * Emit event with comprehensive error handling
     */
    emit(type: MemoryEventType, data?: any, metadata?: Record<string, any>): void {
        if (!this.isEnabled) {
            return;
        }

        const event: MemoryEvent = {
            type,
            timestamp: Date.now(),
            data,
            metadata: {
                ...metadata,
                eventId: this.generateEventId(),
                sequence: this.getEventCount(type)
            }
        };

        // Apply filters
        if (!this.passesFilters(event)) {
            return;
        }

        // Update event count
        this.eventCounts.set(type, (this.eventCounts.get(type) || 0) + 1);

        // Add to history
        this.addToHistory(event);

        // Notify listeners
        this.notifyListeners(type, event);
    }

    /**
     * Add event to history with size management
     */
    private addToHistory(event: MemoryEvent): void {
        this.eventHistory.push(event);
        
        // Maintain history size
        while (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }

    /**
     * Notify all listeners for an event type
     */
    private notifyListeners(type: MemoryEventType, event: MemoryEvent): void {
        const listeners = this.listeners.get(type);
        if (!listeners || listeners.size === 0) {
            return;
        }

        // Create array to avoid modification during iteration
        const listenerArray = Array.from(listeners);
        
        for (const listener of listenerArray) {
            try {
                listener(event);
            } catch (error) {
                console.error(`Error in memory event listener for ${type}:`, error);
                
                // Emit error event (but avoid infinite loops)
                if (type !== MemoryEventType.ERROR_OCCURRED) {
                    this.emit(MemoryEventType.ERROR_OCCURRED, {
                        originalEvent: event,
                        error: error instanceof Error ? error.message : String(error),
                        listenerError: true
                    });
                }
            }
        }
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get event count for a type
     */
    private getEventCount(type: MemoryEventType): number {
        return this.eventCounts.get(type) || 0;
    }

    /**
     * Get event history with optional filtering
     */
    getHistory(type?: MemoryEventType, limit?: number): MemoryEvent[] {
        let events = type 
            ? this.eventHistory.filter(event => event.type === type)
            : [...this.eventHistory];

        if (limit && limit > 0) {
            events = events.slice(-limit);
        }

        return events;
    }

    /**
     * Get event statistics
     */
    getEventStats(): Record<string, any> {
        const stats: Record<string, any> = {
            totalEvents: this.eventHistory.length,
            eventCounts: Object.fromEntries(this.eventCounts),
            activeListeners: this.listeners.size,
            activeFilters: this.filters.size,
            isEnabled: this.isEnabled,
            historySize: this.eventHistory.length,
            maxHistorySize: this.maxHistorySize
        };

        // Calculate event frequency (events per minute)
        if (this.eventHistory.length > 1) {
            const firstEvent = this.eventHistory[0];
            const lastEvent = this.eventHistory[this.eventHistory.length - 1];
            const timeSpan = lastEvent.timestamp - firstEvent.timestamp;
            stats.eventsPerMinute = (this.eventHistory.length / timeSpan) * 60000;
        }

        return stats;
    }

    /**
     * Clear event history
     */
    clearHistory(): void {
        this.eventHistory = [];
    }

    /**
     * Clear event counts
     */
    clearEventCounts(): void {
        this.eventCounts.clear();
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<MemoryManagerConfig>): void {
        if (config.maxEventHistory !== undefined) {
            this.maxHistorySize = config.maxEventHistory;
            
            // Trim history if needed
            while (this.eventHistory.length > this.maxHistorySize) {
                this.eventHistory.shift();
            }
        }
    }

    /**
     * Get listener count for a specific event type
     */
    getListenerCount(type: MemoryEventType): number {
        return this.listeners.get(type)?.size || 0;
    }

    /**
     * Check if there are any listeners for an event type
     */
    hasListeners(type: MemoryEventType): boolean {
        return this.getListenerCount(type) > 0;
    }

    /**
     * Get all registered event types
     */
    getRegisteredEventTypes(): MemoryEventType[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * Destroy the event manager
     */
    destroy(): void {
        this.listeners.clear();
        this.eventHistory = [];
        this.filters.clear();
        this.eventCounts.clear();
        this.isEnabled = false;
    }
}

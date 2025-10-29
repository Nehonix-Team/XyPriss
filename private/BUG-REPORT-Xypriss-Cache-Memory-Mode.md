# 🐛 Bug Report: Xypriss Security Cache - Memory Mode Persistence Issue

**Date**: 2025-10-21  
**Reporter**: Nehonix Team (ProxiShop Project)  
**Severity**: High  
**Status**: Workaround Implemented  
**Affected Package**: `@xypriss/security` (Cache module - Memory mode)

---

## 📋 Summary

The Xypriss Security Cache in **memory mode** does not persist data between function calls within the same Node.js process. Each cache operation appears to work with an isolated instance, causing data loss and breaking session-based features.

---

## 🔍 Problem Description

### Expected Behavior
When using `SCC` (Xypriss Security Cache) in memory mode, data written with `cache.write()` should be retrievable with `cache.read()` in subsequent function calls within the same process lifecycle.

### Actual Behavior
Data written to the cache is **not retrievable** in subsequent calls. The cache behaves as if each import/usage creates a new isolated instance, losing all previously stored data.

### Impact
- **Session management broken**: Temporary chat messages lost between requests
- **User experience degraded**: AI assistant cannot remember conversation context
- **Data inconsistency**: Features relying on in-memory cache fail silently

---

## 🧪 Reproduction Steps

### Test Case 1: Sequential Write/Read Operations

```typescript
import { cache } from "../utils/cache";

// Test 1: Write data
await cache.write("test_key", ["message1"], { ttl: 3600 });
console.log("✅ Written 1 message");

// Test 2: Read data immediately
const data = await cache.read<string[]>("test_key");
console.log("📖 Read back:", data?.length || 0, "messages");
// Expected: 1 message
// Actual: null or undefined
```

### Test Case 2: Accumulation Test

```typescript
// Message 1
await cache.write("session_123", [{ role: "user", content: "Hello" }]);
let messages = await cache.read("session_123");
console.log("Messages:", messages?.length); // Expected: 1, Actual: 1 ✅

// Message 2
const existing = await cache.read("session_123");
await cache.write("session_123", [...existing, { role: "assistant", content: "Hi" }]);
messages = await cache.read("session_123");
console.log("Messages:", messages?.length); // Expected: 2, Actual: 0 or 1 ❌
```

### Test Case 3: Real-World Scenario (Chat Service)

```typescript
// Request 1: User says "je m'appelle Eleazar"
await tempChatStorage.addMessage(sessionId, "user", "je m'appelle Eleazar");
// Cache writes: [{ role: "user", content: "je m'appelle Eleazar" }]

await tempChatStorage.addMessage(sessionId, "assistant", "Enchanté Eleazar!");
// Cache writes: [{ role: "user", ... }, { role: "assistant", ... }]

// Request 2: User asks "comment je m'appelle?"
const history = await tempChatStorage.getMessages(sessionId);
console.log("History:", history.length);
// Expected: 2 messages
// Actual: 0 messages ❌
```

---

## 📊 Observed Logs

### Problematic Behavior with Xypriss Cache

```
🔑 [TempChat] Adding user message for session xxx
📝 [TempChat] Added user message (total: 1 messages)

🔑 [TempChat] Adding assistant message for session xxx
📝 [TempChat] Added assistant message (total: 2 messages)

[Next Request]
🔍 [TempChat] hasMessages check: false (messages: 0)  ❌
📦 [TempChat] Retrieved 0 temp messages  ❌
```

### Working Behavior with Native Map

```
🔑 [TempChat] Adding user message for session xxx
📝 [TempChat] Added user message (total: 1 messages)

🔑 [TempChat] Adding assistant message for session xxx
📝 [TempChat] Added assistant message (total: 2 messages)

[Next Request]
🔍 [TempChat] hasMessages check: true (messages: 2)  ✅
📦 [TempChat] Retrieved 2 temp messages  ✅
```

---

## 🔧 Configuration

### Cache Initialization (`utils/cache.ts`)

```typescript
import { SCC } from "@xypriss/security";

export const cache = new SCC({
  provider: "memory",
  config: {
    memory: {
      maxSize: 100,
      ttl: 3600,
    },
  },
});
```

### Environment
- **Node.js**: v20.x
- **Bun**: v1.1.38
- **@xypriss/security**: Latest version
- **OS**: Linux (Ubuntu)

---

## 💡 Workaround Implemented

We replaced the Xypriss cache with a native JavaScript `Map` singleton:

```typescript
export class TempChatStorage {
  private readonly TTL = 7200000; // 2 hours in ms
  private readonly storage = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  async addMessage(sessionId: string, role: string, content: string): Promise<void> {
    let sessionData = this.storage.get(sessionId);
    
    if (!sessionData) {
      sessionData = {
        messages: [],
        expiresAt: Date.now() + this.TTL,
      };
    }

    sessionData.messages.push({ role, content, timestamp: new Date().toISOString() });
    this.storage.set(sessionId, sessionData);
  }

  async getMessages(sessionId: string): Promise<TempChatMessage[]> {
    const sessionData = this.storage.get(sessionId);
    
    if (!sessionData || sessionData.expiresAt < Date.now()) {
      return [];
    }
    
    return sessionData.messages;
  }
}
```

**Result**: ✅ Works perfectly with full persistence

---

## 🎯 Root Cause Hypothesis

1. **Singleton Pattern Issue**: The `SCC` class might not implement a proper singleton pattern, creating new instances on each import
2. **Memory Provider Bug**: The memory provider might not store data in a shared location across instances
3. **Async/Promise Issue**: Timing issues with async operations causing data loss
4. **TTL Cleanup Bug**: Aggressive cleanup removing data prematurely

---

## 📝 Requested Actions

### For Xypriss Team

1. **Investigate singleton pattern**: Ensure `SCC` returns the same instance across imports
2. **Review memory provider**: Check if data is stored in a process-wide shared location
3. **Add tests**: Include tests for sequential write/read operations
4. **Documentation**: Clarify expected behavior for memory mode persistence

### Test Suite Suggestion

```typescript
describe("SCC Memory Mode Persistence", () => {
  it("should persist data between sequential operations", async () => {
    const cache = new SCC({ provider: "memory" });
    
    await cache.write("key1", "value1");
    const result = await cache.read("key1");
    
    expect(result).toBe("value1");
  });

  it("should accumulate data across multiple writes", async () => {
    const cache = new SCC({ provider: "memory" });
    
    await cache.write("key1", [1]);
    const existing = await cache.read("key1");
    await cache.write("key1", [...existing, 2]);
    const result = await cache.read("key1");
    
    expect(result).toEqual([1, 2]);
  });

  it("should share data across different file imports", async () => {
    // file1.ts
    await cache.write("shared", "data");
    
    // file2.ts (different import)
    const result = await cache.read("shared");
    
    expect(result).toBe("data");
  });
});
```

---

## 📎 Additional Information

### Files Affected in Our Project
- `backend/src/services/temp-chat-storage.ts` (workaround implemented)
- `backend/src/utils/cache.ts` (Xypriss cache config)
- `backend/tests/test-temp-chat-accumulation.ts` (reproduction test)

### Backup File
Original implementation saved at: `backend/src/services/temp-chat-storage.ts.backup`

### Performance Impact
- **Before (Xypriss)**: Chat context lost, poor UX
- **After (Native Map)**: Perfect persistence, excellent UX

---

## 🙏 Thank You

We appreciate the Xypriss Security package and hope this report helps improve the memory cache provider. We're happy to provide additional logs, tests, or collaborate on a fix.

**Contact**: Nehonix Team  
**Project**: ProxiShop (E-commerce with AI Assistant)  
**GitHub**: [Your repo if public]

---

## 📌 Status Updates

- **2025-10-21**: Bug discovered and workaround implemented
- **2025-10-21**: Report sent to Xypriss team
- **Pending**: Response from Xypriss team

---

**Note**: This report will be sent to the Xypriss team for investigation. We remain available for any questions or additional testing.

// Type safety testing for cache methods

import { cache } from "../redis_cache_test";

// Define interfaces for type safety
interface User {
    id: number;
    name: string;
    email: string;
    role: "admin" | "user" | "guest";
    createdAt: Date;
}

interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    inStock: boolean;
}

interface CacheMetrics {
    hitRate: number;
    totalRequests: number;
    averageResponseTime: number;
}

async function testTypeSafety() {
    console.log("🔒 Starting type safety tests...\n");

    // Test 1: Type-safe read/write operations
    console.log("📝 Test 1: Type-Safe Read/Write Operations");

    const user: User = {
        id: 123,
        name: "John Doe",
        email: "john@example.com",
        role: "admin",
        createdAt: new Date(),
    };

    // Type-safe write operation
    const writeSuccess = await cache.write<User>("user:123", user, {
        ttl: 3600, // 1 hour in seconds
        tags: ["users", "admin"],
    });
    console.log(`✅ User stored: ${writeSuccess}`);

    // Type-safe read operation
    const retrievedUser = await cache.read<User>("user:123");
    if (retrievedUser) {
        console.log(
            `✅ Retrieved user: ${retrievedUser.name} (${retrievedUser.role})`
        );
        console.log(`   Email: ${retrievedUser.email}`);
        console.log(`   Created: ${retrievedUser.createdAt}`);
    }

    // Test 2: Type-safe operations with different data
    console.log("\n📖 Test 2: Type-Safe Operations with Different Data");

    const product: Product = {
        id: "prod-456",
        name: "Laptop",
        price: 999.99,
        category: "Electronics",
        inStock: true,
    };

    // Type-safe write operation
    const productWriteSuccess = await cache.write<Product>(
        "product:456",
        product,
        {
            ttl: 7200, // 2 hours in seconds
            tags: ["products", "electronics"],
        }
    );
    console.log(`✅ Product written: ${productWriteSuccess}`);

    // Type-safe read operation
    const retrievedProduct = await cache.read<Product>("product:456");
    if (retrievedProduct) {
        console.log(`✅ Retrieved product: ${retrievedProduct.name}`);
        console.log(`   Price: $${retrievedProduct.price}`);
        console.log(`   In Stock: ${retrievedProduct.inStock}`);
    }

    // Test 3: Type-safe batch operations
    console.log("\n📦 Test 3: Type-Safe Batch Operations");

    const users: Record<string, User> = {
        "user:200": {
            id: 200,
            name: "Alice Smith",
            email: "alice@example.com",
            role: "user",
            createdAt: new Date(),
        },
        "user:201": {
            id: 201,
            name: "Bob Johnson",
            email: "bob@example.com",
            role: "guest",
            createdAt: new Date(),
        },
    };

    // Type-safe mwrite operation (batch write)
    const mwriteSuccess = await cache.mwrite<User>(users, {
        ttl: 1800, // 30 minutes in seconds
        tags: ["users", "batch"],
    });
    console.log(`✅ Batch users stored: ${mwriteSuccess}`);

    // Type-safe mread operation (batch read)
    const retrievedUsers = await cache.mread<User>([
        "user:200",
        "user:201",
        "user:123",
    ]);
    console.log(`✅ Retrieved ${Object.keys(retrievedUsers).length} users:`);

    for (const [key, user] of Object.entries(retrievedUsers)) {
        console.log(`   ${key}: ${user.name} (${user.role})`);
    }

    // Test 4: Type-safe memoization
    console.log("\n🧠 Test 4: Type-Safe Memoization");

    const calculateMetrics = cache.memoize(
        (userId: number) => `metrics:${userId}`,
        (userId: number): CacheMetrics => {
            console.log(`🧮 Computing metrics for user ${userId}`);
            return {
                hitRate: Math.random() * 100,
                totalRequests: Math.floor(Math.random() * 1000),
                averageResponseTime: Math.random() * 50,
            };
        },
        { ttl: 300000, tags: ["metrics"] } // 5 minutes
    );

    // First call - computes
    const metrics1 = await calculateMetrics(123);
    console.log(
        `✅ Computed metrics: Hit rate ${metrics1.hitRate.toFixed(2)}%`
    );

    // Second call - from cache
    const metrics2 = await calculateMetrics(123);
    console.log(`✅ Cached metrics: Hit rate ${metrics2.hitRate.toFixed(2)}%`);

    // Test 5: Type safety with complex nested objects
    console.log("\n🏗️ Test 5: Complex Nested Objects");

    interface UserProfile {
        user: User;
        preferences: {
            theme: "light" | "dark";
            notifications: boolean;
            language: string;
        };
        stats: CacheMetrics;
    }

    const userProfile: UserProfile = {
        user: user,
        preferences: {
            theme: "dark",
            notifications: true,
            language: "en",
        },
        stats: metrics1,
    };

    await cache.write<UserProfile>("profile:123", userProfile, { ttl: 3600 });
    const retrievedProfile = await cache.read<UserProfile>("profile:123");

    if (retrievedProfile) {
        console.log(`✅ Profile for: ${retrievedProfile.user.name}`);
        console.log(`   Theme: ${retrievedProfile.preferences.theme}`);
        console.log(
            `   Notifications: ${retrievedProfile.preferences.notifications}`
        );
        console.log(
            `   Hit rate: ${retrievedProfile.stats.hitRate.toFixed(2)}%`
        );
    }

    console.log("\n✅ Type safety tests completed!");
    console.log("🎯 All operations maintain full TypeScript type checking!");
}

if (require.main === module) {
    testTypeSafety().catch(console.error);
}

export { testTypeSafety };


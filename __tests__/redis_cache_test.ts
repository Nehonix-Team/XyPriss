import { SCC } from "../mods/securitysrc/components/cache";

export const cache = new SCC({
    strategy: "redis",
    redis: {
        password: "3eN97OSvAPxK1rvDFgzFuZ4b7ECZfSGZ",
        host: "redis-19820.c245.us-east-1-3.ec2.redns.redis-cloud.com",
        port: 19820,
        // cluster: true,
    },
    ttl: 3600, // Default 1 hour TTL
});

// Initialize connection
// cache
//     .connect()
//     .then(() => {
//         console.log("Connected to Redis");
//     })
//     .catch((error) => {
//         console.error("Failed to connect to Redis:", error);
//     });

// await cache.connect();


# XyPriss Plugin Development Guide

This guide covers how to develop, use, and manage plugins in XyPriss.

## Plugin System Overview

XyPriss features an extensible plugin system that allows you to:
- Add custom functionality to your server
- Extend core features
- Create reusable components
- Integrate third-party services
- Implement custom middleware and routes

## Plugin Architecture

### Plugin Interface

```typescript
interface Plugin {
    name: string;
    version: string;
    description?: string;
    dependencies?: string[];
    
    initialize(context: PluginContext): Promise<void>;
    execute(context: PluginContext): Promise<any>;
    cleanup?(): Promise<void>;
}
```

### Plugin Context

```typescript
interface PluginContext {
    app: Express;
    server: XyPrissServer;
    config: PluginConfig;
    logger: Logger;
    cache: CacheManager;
    metrics: PerformanceManager;
}
```

## Built-in Plugins

XyPriss comes with several built-in plugins:

### 1. Route Optimization Plugin
Optimizes route handling and caching.

### 2. Server Maintenance Plugin
Provides health checks and graceful shutdown.

### 3. Performance Monitoring Plugin
Collects and reports performance metrics.

## Creating a Custom Plugin

### Basic Plugin Structure

```typescript
import { Plugin, PluginContext } from "xypriss";

export class MyCustomPlugin implements Plugin {
    name = "my-custom-plugin";
    version = "1.0.0";
    description = "A custom plugin for XyPriss";
    
    async initialize(context: PluginContext): Promise<void> {
        context.logger.info(`Initializing ${this.name} v${this.version}`);
        
        // Plugin initialization logic
        // Set up routes, middleware, etc.
    }
    
    async execute(context: PluginContext): Promise<any> {
        // Main plugin execution logic
        // This is called after initialization
        
        return { status: "success" };
    }
    
    async cleanup(): Promise<void> {
        // Cleanup logic when server shuts down
        console.log(`Cleaning up ${this.name}`);
    }
}
```

### Example: Database Connection Plugin

```typescript
import { Plugin, PluginContext } from "xypriss";
import { Pool } from "pg";

export class DatabasePlugin implements Plugin {
    name = "database-connection";
    version = "1.0.0";
    description = "PostgreSQL database connection plugin";
    
    private pool: Pool | null = null;
    
    async initialize(context: PluginContext): Promise<void> {
        const { config, logger } = context;
        
        // Create database connection pool
        this.pool = new Pool({
            host: config.options.host || "localhost",
            port: config.options.port || 5432,
            database: config.options.database,
            user: config.options.user,
            password: config.options.password,
            max: config.options.maxConnections || 20
        });
        
        // Test connection
        try {
            const client = await this.pool.connect();
            await client.query("SELECT NOW()");
            client.release();
            logger.info("Database connection established");
        } catch (error) {
            logger.error("Database connection failed:", error);
            throw error;
        }
        
        // Add database to context for other plugins/routes
        (context.app as any).db = this.pool;
    }
    
    async execute(context: PluginContext): Promise<any> {
        // Add health check route
        context.app.get("/health/database", async (req, res) => {
            try {
                const client = await this.pool!.connect();
                const result = await client.query("SELECT NOW() as timestamp");
                client.release();
                
                res.json({
                    status: "healthy",
                    timestamp: result.rows[0].timestamp
                });
            } catch (error) {
                res.status(503).json({
                    status: "unhealthy",
                    error: error.message
                });
            }
        });
        
        return { status: "database plugin active" };
    }
    
    async cleanup(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            console.log("Database connections closed");
        }
    }
}
```

### Example: Authentication Plugin

```typescript
import { Plugin, PluginContext } from "xypriss";
import jwt from "jsonwebtoken";

export class AuthenticationPlugin implements Plugin {
    name = "jwt-authentication";
    version = "1.0.0";
    description = "JWT-based authentication plugin";
    
    private jwtSecret: string = "";
    
    async initialize(context: PluginContext): Promise<void> {
        const { config, logger } = context;
        
        this.jwtSecret = config.options.jwtSecret || process.env.JWT_SECRET;
        
        if (!this.jwtSecret) {
            throw new Error("JWT secret is required for authentication plugin");
        }
        
        logger.info("Authentication plugin initialized");
    }
    
    async execute(context: PluginContext): Promise<any> {
        const { app } = context;
        
        // Add authentication middleware to app
        const authenticateToken = (req: any, res: any, next: any) => {
            const authHeader = req.headers["authorization"];
            const token = authHeader && authHeader.split(" ")[1];
            
            if (!token) {
                return res.status(401).json({ error: "Access token required" });
            }
            
            jwt.verify(token, this.jwtSecret, (err: any, user: any) => {
                if (err) {
                    return res.status(403).json({ error: "Invalid token" });
                }
                req.user = user;
                next();
            });
        };
        
        // Make middleware available globally
        (app as any).authenticateToken = authenticateToken;
        
        // Add login route
        app.post("/auth/login", async (req, res) => {
            const { username, password } = req.body;
            
            // Implement your user verification logic here
            const user = await this.verifyUser(username, password);
            
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                this.jwtSecret,
                { expiresIn: "1h" }
            );
            
            res.json({ token, user: { id: user.id, username: user.username } });
        });
        
        return { status: "authentication routes added" };
    }
    
    private async verifyUser(username: string, password: string): Promise<any> {
        // Implement your user verification logic
        // This is just a placeholder
        if (username === "admin" && password === "password") {
            return { id: 1, username: "admin" };
        }
        return null;
    }
}
```

## Using Plugins

### Plugin Configuration

```typescript
import { createServer } from "xypriss";
import { DatabasePlugin } from "./plugins/DatabasePlugin";
import { AuthenticationPlugin } from "./plugins/AuthenticationPlugin";

const server = createServer({
    plugins: [
        {
            name: "database-connection",
            plugin: new DatabasePlugin(),
            enabled: true,
            options: {
                host: "localhost",
                port: 5432,
                database: "myapp",
                user: "dbuser",
                password: "dbpassword",
                maxConnections: 20
            }
        },
        {
            name: "jwt-authentication",
            plugin: new AuthenticationPlugin(),
            enabled: true,
            options: {
                jwtSecret: process.env.JWT_SECRET
            }
        }
    ]
});
```

### Loading Plugins from Files

```typescript
import { createServer } from "xypriss";
import path from "path";

const server = createServer({
    plugins: [
        {
            name: "my-plugin",
            path: path.join(__dirname, "plugins", "MyPlugin.js"),
            enabled: true,
            options: {
                customOption: "value"
            }
        }
    ]
});
```

## Plugin Lifecycle

### 1. Loading Phase
- Plugin files are loaded
- Plugin classes are instantiated
- Dependencies are checked

### 2. Initialization Phase
- `initialize()` method is called
- Plugin sets up its resources
- Routes and middleware are registered

### 3. Execution Phase
- `execute()` method is called
- Plugin becomes active
- Main functionality is available

### 4. Cleanup Phase
- `cleanup()` method is called (if defined)
- Resources are released
- Connections are closed

## Plugin Management

### Plugin Manager API

```typescript
// Get plugin manager
const pluginManager = server.getPluginManager();

// List loaded plugins
const plugins = pluginManager.getLoadedPlugins();
console.log(plugins);

// Get specific plugin
const authPlugin = pluginManager.getPlugin("jwt-authentication");

// Enable/disable plugin
await pluginManager.enablePlugin("my-plugin");
await pluginManager.disablePlugin("my-plugin");

// Reload plugin
await pluginManager.reloadPlugin("my-plugin");
```

### Hot Plugin Reloading

```typescript
// Enable hot reloading in development
const server = createServer({
    plugins: [
        {
            name: "my-plugin",
            path: "./plugins/MyPlugin.js",
            hotReload: process.env.NODE_ENV === "development"
        }
    ]
});
```

## Advanced Plugin Features

### Plugin Dependencies

```typescript
export class AdvancedPlugin implements Plugin {
    name = "advanced-plugin";
    version = "1.0.0";
    dependencies = ["database-connection", "jwt-authentication"];
    
    async initialize(context: PluginContext): Promise<void> {
        // This plugin will only load after its dependencies
        const db = (context.app as any).db;
        const auth = (context.app as any).authenticateToken;
        
        if (!db || !auth) {
            throw new Error("Required dependencies not available");
        }
    }
}
```

### Plugin Communication

```typescript
export class PublisherPlugin implements Plugin {
    name = "publisher";
    version = "1.0.0";
    
    async execute(context: PluginContext): Promise<any> {
        // Emit events for other plugins
        context.server.emit("custom-event", { data: "hello" });
    }
}

export class SubscriberPlugin implements Plugin {
    name = "subscriber";
    version = "1.0.0";
    
    async initialize(context: PluginContext): Promise<void> {
        // Listen for events from other plugins
        context.server.on("custom-event", (data) => {
            console.log("Received event:", data);
        });
    }
}
```

### Plugin Configuration Validation

```typescript
import Joi from "joi";

export class ValidatedPlugin implements Plugin {
    name = "validated-plugin";
    version = "1.0.0";
    
    private configSchema = Joi.object({
        apiKey: Joi.string().required(),
        timeout: Joi.number().min(1000).default(5000),
        retries: Joi.number().min(0).max(5).default(3)
    });
    
    async initialize(context: PluginContext): Promise<void> {
        // Validate plugin configuration
        const { error, value } = this.configSchema.validate(context.config.options);
        
        if (error) {
            throw new Error(`Plugin configuration error: ${error.message}`);
        }
        
        // Use validated configuration
        const config = value;
        console.log("Plugin configured with:", config);
    }
}
```

## Testing Plugins

### Unit Testing

```typescript
import { MyCustomPlugin } from "../plugins/MyCustomPlugin";

describe("MyCustomPlugin", () => {
    let plugin: MyCustomPlugin;
    let mockContext: any;
    
    beforeEach(() => {
        plugin = new MyCustomPlugin();
        mockContext = {
            app: {
                get: jest.fn(),
                post: jest.fn(),
                use: jest.fn()
            },
            logger: {
                info: jest.fn(),
                error: jest.fn()
            },
            config: {
                options: {}
            }
        };
    });
    
    it("should initialize successfully", async () => {
        await expect(plugin.initialize(mockContext)).resolves.not.toThrow();
        expect(mockContext.logger.info).toHaveBeenCalled();
    });
    
    it("should execute successfully", async () => {
        await plugin.initialize(mockContext);
        const result = await plugin.execute(mockContext);
        expect(result.status).toBe("success");
    });
});
```

### Integration Testing

```typescript
import { createServer } from "xypriss";
import request from "supertest";
import { MyCustomPlugin } from "../plugins/MyCustomPlugin";

describe("Plugin Integration", () => {
    let server: any;
    
    beforeAll(async () => {
        server = createServer({
            plugins: [
                {
                    name: "my-custom-plugin",
                    plugin: new MyCustomPlugin(),
                    enabled: true
                }
            ]
        });
        
        // Wait for plugins to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    it("should handle plugin routes", async () => {
        const response = await request(server)
            .get("/plugin-route")
            .expect(200);
            
        expect(response.body).toHaveProperty("message");
    });
});
```

## Best Practices

### 1. Plugin Structure
- Keep plugins focused on a single responsibility
- Use clear, descriptive names
- Include proper version information
- Document plugin configuration options

### 2. Error Handling
- Handle errors gracefully in all plugin methods
- Provide meaningful error messages
- Don't crash the entire server on plugin errors

### 3. Resource Management
- Clean up resources in the `cleanup()` method
- Close database connections, file handles, etc.
- Remove event listeners and timers

### 4. Configuration
- Validate plugin configuration
- Provide sensible defaults
- Use environment variables for sensitive data

### 5. Testing
- Write unit tests for plugin logic
- Test plugin integration with XyPriss
- Test error conditions and edge cases

### 6. Documentation
- Document plugin functionality
- Provide usage examples
- Document configuration options

This plugin system allows you to extend XyPriss with custom functionality while maintaining clean separation of concerns and easy maintainability.

/**
 * Test Router System and Enhanced Security Middleware
 */

import { createApp } from "../server/core/XyprissApp";
import { Router } from "../server/routing";

// Create XyPriss app
const app = createApp();

console.log("🚀 Testing XyPriss Router System and Enhanced Security Middleware...");

// ===== ROUTER SYSTEM TESTING =====

// Create API router
const apiRouter = Router();

// Add middleware to the router
apiRouter.use((req: any, res: any, next: any) => {
    console.log(`🔍 API Router Middleware: ${req.method} ${req.path}`);
    next();
});

// Add routes to the API router
apiRouter.get('/users', (req: any, res: any) => {
    res.json({ 
        message: 'Users endpoint', 
        users: [
            { id: 1, name: 'John Doe' },
            { id: 2, name: 'Jane Smith' }
        ]
    });
});

apiRouter.post('/users', (req: any, res: any) => {
    res.json({ 
        message: 'User created', 
        user: { id: 3, name: 'New User' }
    });
});

apiRouter.get('/posts/:id', (req: any, res: any) => {
    res.json({ 
        message: 'Post endpoint', 
        post: { id: req.params.id, title: 'Sample Post' }
    });
});

// Create admin router
const adminRouter = Router();

adminRouter.use((req: any, res: any, next: any) => {
    console.log(`🔐 Admin Router Middleware: ${req.method} ${req.path}`);
    next();
});

adminRouter.get('/dashboard', (req: any, res: any) => {
    res.json({ message: 'Admin Dashboard' });
});

adminRouter.get('/settings', (req: any, res: any) => {
    res.json({ message: 'Admin Settings' });
});

// Mount routers on the app
app.use('/api', apiRouter);
app.use('/admin', adminRouter);

// ===== ENHANCED SECURITY MIDDLEWARE TESTING =====

console.log("🛡️ Configuring Enhanced Security Middleware...");

// Configure comprehensive security middleware
app.middleware()
    .register((req: any, res: any, next: any) => {
        console.log(`📝 Custom Logger: ${req.method} ${req.url}`);
        next();
    }, { name: "custom-logger", priority: "normal" })
    
    // Add new security middleware
    .hpp({ whitelist: ['tags', 'categories'] })
    .mongoSanitize({ replaceWith: '_' })
    .xss({ whiteList: { a: ['href'], b: [], i: [] } })
    .morgan({ format: 'combined', skip: (req: any, res: any) => res.statusCode < 400 })
    .slowDown({ 
        windowMs: 15 * 60 * 1000, 
        delayAfter: 5, 
        delayMs: 1000,
        maxDelayMs: 10000 
    })
    .brute({ 
        freeRetries: 3, 
        minWait: 2 * 60 * 1000, 
        maxWait: 10 * 60 * 1000 
    });

// Add some basic routes for testing
app.get('/', (req: any, res: any) => {
    res.json({ 
        message: 'XyPriss Server with Router System and Enhanced Security!',
        features: [
            'Express-like Router System',
            '12 Built-in Security Middleware',
            'Automatic Security Protection',
            'Modular Route Organization'
        ]
    });
});

app.get('/test-security', (req: any, res: any) => {
    res.json({ 
        message: 'Security middleware test endpoint',
        security: {
            helmet: 'Security headers applied',
            cors: 'Cross-origin requests configured',
            rateLimit: 'Rate limiting active',
            hpp: 'Parameter pollution protection',
            mongoSanitize: 'NoSQL injection protection',
            xss: 'XSS protection enabled',
            compression: 'Response compression active',
            slowDown: 'Progressive delay protection',
            brute: 'Brute force protection'
        }
    });
});

// Show middleware and router statistics
console.log("📊 Middleware Stats:", app.middleware().stats());
console.log("📋 Middleware List:", app.middleware().list());

// Start the server
const port = 8080;
app.listen(port, () => {
    console.log(`🎉 XyPriss server running on http://localhost:${port}`);
    console.log("\n🔗 Test Routes:");
    console.log("  GET  /                    - Main endpoint");
    console.log("  GET  /test-security       - Security test endpoint");
    console.log("  GET  /api/users           - API users endpoint");
    console.log("  POST /api/users           - API create user");
    console.log("  GET  /api/posts/:id       - API post by ID");
    console.log("  GET  /admin/dashboard     - Admin dashboard");
    console.log("  GET  /admin/settings      - Admin settings");
    console.log("\n🛡️ Security Features Active:");
    console.log("  ✅ Helmet - Security headers");
    console.log("  ✅ CORS - Cross-origin protection");
    console.log("  ✅ Rate Limiting - Request throttling");
    console.log("  ✅ HPP - Parameter pollution protection");
    console.log("  ✅ Mongo Sanitize - NoSQL injection protection");
    console.log("  ✅ XSS - Cross-site scripting protection");
    console.log("  ✅ Morgan - Request logging");
    console.log("  ✅ Slow Down - Progressive delays");
    console.log("  ✅ Brute Force - Attack protection");
    console.log("  ✅ Compression - Response compression");
});

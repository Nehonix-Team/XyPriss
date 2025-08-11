/**
 * Simple Router Test
 */

import { createApp } from "../server/core/XyprissApp";
import { XyPrissRouter } from "../server/routing/Router";

// Create XyPriss app 
const app = createApp();

console.log("🚀 Testing Simple Router System...");

// Create a simple router
const router = new XyPrissRouter();

// Add a simple route
router.get('/test', (req: any, res: any) => {
    res.json({ message: 'Router test successful!' });
});

// Mount the router
app.use('/api', router);

// Add a basic route to the app
app.get('/', (req: any, res: any) => {
    res.json({ 
        message: 'XyPriss with Router System!',
        routes: [
            'GET /',
            'GET /api/test'
        ]
    });
});

// Show middleware stats
console.log("📊 Middleware Stats:", app.middleware().stats());

// Start the server
const port = 8080;
app.listen(port, () => {
    console.log(`🎉 XyPriss server running on http://localhost:${port}`);
    console.log("Test routes:");
    console.log("  GET /         - Main endpoint");
    console.log("  GET /api/test - Router test endpoint");
});

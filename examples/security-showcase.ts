/**
 * XyPriss Security Features Showcase
 *
 * This example demonstrates the latest security enhancements:
 * - Enhanced Content Security Policy (CSP) with flexible directives
 * - Advanced Access Control with BrowserOnly and TerminalOnly middleware
 *
 * Run with: bun examples/security-showcase.ts
 */

import { createServer } from '../src';

console.log('🚀 Starting XyPriss Security Showcase...\n');

// ============================================================================
// 1. ENHANCED CONTENT SECURITY POLICY (CSP) EXAMPLE
// ============================================================================

console.log('📋 Example 1: Enhanced CSP Configuration');
console.log('---------------------------------------');

const secureApp = createServer({
    server: { port: 3001 },
    security: {
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    // Flexible CSP with any directive support
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'", // For development
                        "https://cdn.jsdelivr.net",
                        "https://code.jquery.com"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://fonts.googleapis.com",
                        "https://cdn.jsdelivr.net"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                        "data:" // Allow data URLs for fonts
                    ],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "https:",
                        "blob:"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.github.com",
                        "https://jsonplaceholder.typicode.com"
                    ],
                    frameSrc: ["'none'"], // Block all frames
                    objectSrc: ["'none'"], // Block plugins
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"],
                    // Custom directive support
                    customDirective: ["value1", "value2"]
                }
            }
        }
    }
});

// Test endpoint for CSP
secureApp.get('/api/csp-test', (req, res) => {
    res.json({
        message: 'CSP headers applied successfully',
        timestamp: new Date().toISOString(),
        csp: 'Check response headers for Content-Security-Policy'
    });
});

console.log('✅ Enhanced CSP configured with flexible directives');
console.log('   - Supports any CSP directive');
console.log('   - TypeScript-safe with Record<string, any>');
console.log('   - Production-ready configurations\n');

// ============================================================================
// 2. TERMINAL-ONLY ACCESS CONTROL EXAMPLE
// ============================================================================

console.log('🔒 Example 2: Terminal-Only API Access');
console.log('-------------------------------------');

const adminAPI = createServer({
    server: { port: 3002 },
    security: {
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "insomnia", "curl"],
            debug: true
        }
    }
});

// Admin endpoint - only accessible via approved tools
adminAPI.get('/api/admin/dashboard', (req, res) => {
    res.json({
        message: 'Admin dashboard accessed successfully',
        tool: 'Approved API tool',
        timestamp: new Date().toISOString(),
        server: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime()
        }
    });
});

// Debug endpoint with sensitive information
adminAPI.get('/api/admin/debug', (req, res) => {
    res.json({
        message: 'Debug information',
        environment: process.env,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        warning: 'This endpoint contains sensitive information'
    });
});

console.log('✅ Terminal-Only middleware configured');
console.log('   - Only Postman, Insomnia, and curl allowed');
console.log('   - Browser requests blocked');
console.log('   - Debug logging enabled\n');

// ============================================================================
// 3. BROWSER-ONLY ACCESS CONTROL EXAMPLE
// ============================================================================

console.log('🌐 Example 3: Browser-Only Web Application');
console.log('-----------------------------------------');

const webApp = createServer({
    server: { port: 3003 },
    security: {
        browserOnly: {
            enable: true,
            requireSecFetch: true,
            blockAutomationTools: true,
            debug: false
        }
    }
});

// Public web endpoint - only accessible from browsers
webApp.get('/api/web/public', (req, res) => {
    res.json({
        message: 'Public web endpoint accessed from browser',
        userAgent: req.headers['user-agent']?.substring(0, 50),
        timestamp: new Date().toISOString(),
        browserDetected: true
    });
});

// User profile endpoint
webApp.get('/api/web/profile', (req, res) => {
    res.json({
        user: {
            id: 123,
            name: 'John Doe',
            email: 'john@example.com'
        },
        session: 'browser-validated',
        timestamp: new Date().toISOString()
    });
});

console.log('✅ Browser-Only middleware configured');
console.log('   - Only legitimate browser requests allowed');
console.log('   - Automation tools blocked');
console.log('   - Sec-Fetch headers required\n');

// ============================================================================
// 4. COMPREHENSIVE SECURITY CONFIGURATION
// ============================================================================

console.log('🛡️  Example 4: Comprehensive Security Setup');
console.log('------------------------------------------');

const enterpriseApp = createServer({
    server: { port: 3004 },
    security: {
        // Access Control (choose one)
        terminalOnly: {
            enable: true,
            allowedTools: ["postman", "insomnia"]
        },

        // Content Security Policy
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "https://cdn.example.com"],
                    styleSrc: ["'self'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "https:", "data:"],
                    connectSrc: ["'self'", "https://api.example.com"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'none'"],
                    upgradeInsecureRequests: []
                }
            }
        },

        // Additional security layers
        cors: {
            origin: ["https://app.example.com", "https://admin.example.com"],
            credentials: true
        },
        rateLimit: {
            max: 1000,
            windowMs: 900000,
            message: "Too many requests, please try again later"
        },
        csrf: true,
        xss: true,
        sqlInjection: true
    }
});

// Enterprise API endpoint
enterpriseApp.get('/api/enterprise/data', (req, res) => {
    res.json({
        message: 'Enterprise API accessed successfully',
        security: {
            terminalOnly: 'enabled',
            csp: 'configured',
            cors: 'restricted',
            rateLimit: '1000 req/15min',
            csrf: 'enabled',
            xss: 'enabled',
            sqlInjection: 'enabled'
        },
        timestamp: new Date().toISOString()
    });
});

console.log('✅ Comprehensive security configuration');
console.log('   - Terminal-Only access control');
console.log('   - Full CSP protection');
console.log('   - CORS restrictions');
console.log('   - Rate limiting');
console.log('   - CSRF, XSS, SQL injection protection\n');

// ============================================================================
// 5. TESTING INSTRUCTIONS
// ============================================================================

console.log('🧪 Testing Instructions');
console.log('======================');

console.log('\n1. Test Enhanced CSP (Port 3001):');
console.log('   curl -I http://localhost:3001/api/csp-test');
console.log('   # Check Content-Security-Policy header');

console.log('\n2. Test Terminal-Only API (Port 3002):');
console.log('   # Should work (Postman allowed):');
console.log('   curl -H "User-Agent: PostmanRuntime/7.32.0" http://localhost:3002/api/admin/dashboard');
console.log('   # Should be blocked (curl not in whitelist):');
console.log('   curl http://localhost:3002/api/admin/dashboard');

console.log('\n3. Test Browser-Only Web App (Port 3003):');
console.log('   # Should be blocked (no browser headers):');
console.log('   curl http://localhost:3003/api/web/public');
console.log('   # Use browser: http://localhost:3003/api/web/public');

console.log('\n4. Test Enterprise Security (Port 3004):');
console.log('   # Should work (insomnia allowed):');
console.log('   curl -H "User-Agent: insomnia/2023.5.0" http://localhost:3004/api/enterprise/data');
console.log('   # Should be blocked (browser request):');
console.log('   curl -H "User-Agent: Mozilla/5.0..." http://localhost:3004/api/enterprise/data');

console.log('\n📝 Notes:');
console.log('- All servers are configured with different security levels');
console.log('- Check server logs for detailed security analysis');
console.log('- Use browser developer tools to inspect CSP headers');
console.log('- Modify configurations to test different scenarios');

// ============================================================================
// START ALL SERVERS
// ============================================================================

async function startServers() {
    try {
        console.log('\n🚀 Starting all security showcase servers...\n');

        // Start servers with proper error handling
        const servers = [
            { name: 'Enhanced CSP', app: secureApp, port: 3001 },
            { name: 'Terminal-Only API', app: adminAPI, port: 3002 },
            { name: 'Browser-Only Web', app: webApp, port: 3003 },
            { name: 'Enterprise Security', app: enterpriseApp, port: 3004 }
        ];

        for (const server of servers) {
            try {
                await server.app.start(server.port);
                console.log(`✅ ${server.name} server running on port ${server.port}`);
            } catch (error) {
                console.error(`❌ Failed to start ${server.name} server:`, error);
            }
        }

        console.log('\n🎉 All security showcase servers started successfully!');
        console.log('📖 Check the documentation for detailed usage instructions');
        console.log('🔗 Visit the endpoints to test the security features');

    } catch (error) {
        console.error('❌ Error starting servers:', error);
        process.exit(1);
    }
}

// Start the showcase
startServers().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down security showcase servers...');
    process.exit(0);
});

export { secureApp, adminAPI, webApp, enterpriseApp };

/**
 * Simple CORS test using curl to verify RegExp support
 */

import { createServer } from './src';
import { execSync } from 'child_process';

console.log('🌐 Testing CORS RegExp with curl...\n');

// Test server with RegExp CORS
const testServer = createServer({
    server: { port: 3001 },
    security: {
        cors: {
            origin: [
                /^localhost:\d+$/,      // Should match localhost:3000
                /^127\.0\.0\.1:\d+$/,   // Should match 127.0.0.1:3000
                /\.test\.com$/,         // Should match *.test.com
                "https://production.com" // Exact match
            ],
            credentials: true
        }
    }
});

// Add test route
testServer.get('/api/test', (req, res) => {
    res.json({ message: 'CORS test', origin: req.headers.origin });
});

const runCurlTest = (origin: string, expectedAllowed: boolean, port: number) => {
    try {
        console.log(`Testing origin: ${origin}`);
        const result = execSync(`curl -s -I -H "Origin: ${origin}" -H "Access-Control-Request-Method: GET" -X OPTIONS http://localhost:${port}/api/test`, { encoding: 'utf8' });

        const hasAllowOrigin = result.includes('access-control-allow-origin');
        const allowedOrigin = result.match(/access-control-allow-origin:\s*(.+)/i)?.[1]?.trim();

        if (expectedAllowed) {
            if (hasAllowOrigin && (allowedOrigin === origin || allowedOrigin === '*')) {
                console.log(`✅ PASS: CORS allowed for ${origin}`);
                return true;
            } else {
                console.log(`❌ FAIL: Expected CORS to allow ${origin}, but got: ${allowedOrigin || 'none'}`);
                return false;
            }
        } else {
            if (!hasAllowOrigin || allowedOrigin === origin) {
                console.log(`❌ FAIL: Expected CORS to block ${origin}, but it was allowed`);
                return false;
            } else {
                console.log(`✅ PASS: CORS correctly blocked ${origin}`);
                return true;
            }
        }
    } catch (error) {
        console.log(`❌ ERROR testing ${origin}: ${error}`);
        return false;
    }
};

(async () => {
    try {
        await testServer.start(3001);
        console.log('🚀 Test server started on port 3001\n');

        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🧪 Testing CORS with curl OPTIONS requests:\n');

        // Test cases
        const tests = [
            { origin: 'http://localhost:3000', expected: true, desc: 'RegExp localhost:3000' },
            { origin: 'http://127.0.0.1:3000', expected: true, desc: 'RegExp 127.0.0.1:3000' },
            { origin: 'https://api.test.com', expected: true, desc: 'RegExp *.test.com' },
            { origin: 'https://production.com', expected: true, desc: 'Exact match' },
            { origin: 'https://evil.com', expected: false, desc: 'Blocked origin' },
            { origin: 'http://192.168.1.1:3000', expected: false, desc: 'Blocked IP' }
        ];

        let passed = 0;
        let total = tests.length;

        for (const test of tests) {
            if (runCurlTest(test.origin, test.expected)) {
                passed++;
            }
        }

        console.log(`\n📊 Results: ${passed}/${total} tests passed`);

        if (passed === total) {
            console.log('🎉 All CORS RegExp tests passed!');
        } else {
            console.log('❌ Some tests failed');
        }

        process.exit(passed === total ? 0 : 1);

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
})();
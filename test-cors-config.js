const cors = require('cors');

// Test what the cors library accepts
const testConfig = {
    origin: 'http://example.com',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

console.log('Testing cors configuration...');
console.log('Config:', JSON.stringify(testConfig, null, 2));

try {
    const middleware = cors(testConfig);
    console.log('✅ CORS middleware created successfully');
    console.log('Middleware type:', typeof middleware);
} catch (error) {
    console.error('❌ Error creating CORS middleware:', error.message);
}

// Check if cors expects different parameter names
console.log('\n--- Checking cors library documentation ---');
const corsModule = require('cors');
console.log('Available properties:', Object.keys(corsModule));

// Test CORS configuration
import cors from 'cors';

const corsConfig = {
    origin: "*",
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
};

const middleware = cors(corsConfig);
 
console.log('CORS config:', JSON.stringify(corsConfig, null, 2));
console.log('CORS middleware created successfully');

// Simulate an OPTIONS request
const mockReq = {
    method: 'OPTIONS',
    headers: {
        'origin': 'http://example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-guest-token'
    }
};

const mockRes = {
    setHeader: (name, value) => {
        console.log(`Response header: ${name}: ${value}`);
    },
    end: () => console.log('Response ended')
};

console.log('\nSimulating OPTIONS request...');
middleware(mockReq, mockRes, () => {
    console.log('Request passed through CORS');
});

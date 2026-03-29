#!/usr/bin/env node

/**
 * Test script to verify trust proxy functionality
 * This simulates requests that would come through a reverse proxy like Nginx
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3001';

// Test cases to simulate different proxy scenarios
const testCases = [
    {
        name: "Direct request (no proxy headers)",
        headers: {},
        description: "Should show the actual client IP"
    },
    {
        name: "Nginx reverse proxy",
        headers: {
            'X-Forwarded-For': '203.0.113.195, 70.41.3.18, 150.172.238.178',
            'X-Forwarded-Proto': 'https',
            'X-Forwarded-Host': 'example.com',
            'X-Real-IP': '203.0.113.195'
        },
        description: "Should trust X-Forwarded-For and show 203.0.113.195 as client IP"
    },
    {
        name: "Cloudflare proxy",
        headers: {
            'CF-Connecting-IP': '198.51.100.42',
            'X-Forwarded-For': '198.51.100.42',
            'X-Forwarded-Proto': 'https',
            'CF-Ray': '1234567890abcdef-LAX'
        },
        description: "Should show Cloudflare's connecting IP"
    },
    {
        name: "Load balancer chain",
        headers: {
            'X-Forwarded-For': '192.0.2.60, 198.51.100.178, 203.0.113.15',
            'X-Forwarded-Proto': 'https',
            'X-Forwarded-Port': '443'
        },
        description: "Should show the first IP in the chain (192.0.2.60)"
    }
];

function makeRequest(testCase) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/proxy-test',
            method: 'GET',
            headers: {
                'User-Agent': 'Trust-Proxy-Test/1.0',
                ...testCase.headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({ testCase, response, statusCode: res.statusCode });
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Trust Proxy Functionality\n');
    console.log('=' .repeat(80));
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        try {
            console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
            console.log(`📝 ${testCase.description}`);
            console.log('-'.repeat(60));
            
            const result = await makeRequest(testCase);
            
            if (result.statusCode === 200) {
                console.log('✅ Status: SUCCESS');
                console.log(`🌐 Detected IP: ${result.response.clientInfo.ip}`);
                console.log(`🔒 Protocol: ${result.response.clientInfo.protocol}`);
                console.log(`🏠 Hostname: ${result.response.clientInfo.hostname}`);
                console.log(`🔐 Secure: ${result.response.clientInfo.secure}`);
                
                if (result.response.clientInfo.ips && result.response.clientInfo.ips.length > 0) {
                    console.log(`📊 IPs Array: [${result.response.clientInfo.ips.join(', ')}]`);
                }
                
                // Show relevant headers
                const relevantHeaders = ['x-forwarded-for', 'x-forwarded-proto', 'x-real-ip'];
                const headers = result.response.headers;
                
                console.log('\n📨 Proxy Headers:');
                relevantHeaders.forEach(header => {
                    if (headers[header]) {
                        console.log(`   ${header}: ${headers[header]}`);
                    }
                });
                
                // Analysis
                console.log('\n🔍 Analysis:');
                if (testCase.headers['X-Forwarded-For']) {
                    const expectedIP = testCase.headers['X-Forwarded-For'].split(',')[0].trim();
                    if (result.response.clientInfo.ip === expectedIP) {
                        console.log(`   ✅ Trust proxy working: Expected ${expectedIP}, got ${result.response.clientInfo.ip}`);
                    } else {
                        console.log(`   ❌ Trust proxy issue: Expected ${expectedIP}, got ${result.response.clientInfo.ip}`);
                    }
                } else {
                    console.log(`   ℹ️  Direct connection, IP: ${result.response.clientInfo.ip}`);
                }
                
            } else {
                console.log(`❌ Status: FAILED (HTTP ${result.statusCode})`);
            }
            
        } catch (error) {
            console.log(`❌ Status: ERROR - ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 Test completed!');
    console.log('\n💡 Tips:');
    console.log('   - If trust proxy is working, X-Forwarded-For IPs should be detected');
    console.log('   - req.ip should show the first IP from X-Forwarded-For chain');
    console.log('   - req.ips should contain the full proxy chain');
    console.log('   - Protocol should be detected from X-Forwarded-Proto');
}

// Run the tests
runTests().catch(console.error);

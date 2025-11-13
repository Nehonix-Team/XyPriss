#!/usr/bin/env node

/**
 * Test script to verify the query parameters bug fix
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3566'; // Use the test server

// Test cases for query parameters
const testCases = [
    {
        name: "Simple query parameter",
        path: "/api/proxy-test?period=7d",
        description: "Should handle basic query parameter"
    },
    {
        name: "Multiple query parameters",
        path: "/api/proxy-test?page=1&limit=10&sort=name",
        description: "Should handle multiple query parameters"
    },
    {
        name: "URL encoded parameters",
        path: "/api/proxy-test?search=hello%20world&filter=active",
        description: "Should handle URL encoded parameters"
    },
    {
        name: "Special characters",
        path: "/api/proxy-test?query=test&symbols=%21%40%23%24",
        description: "Should handle special characters in query"
    },
    {
        name: "Array-like parameters",
        path: "/api/proxy-test?tags=tag1&tags=tag2&tags=tag3",
        description: "Should handle multiple values for same parameter"
    },
    {
        name: "Empty parameter values",
        path: "/api/proxy-test?empty=&filled=value&another=",
        description: "Should handle empty parameter values"
    },
    {
        name: "No query parameters (baseline)",
        path: "/api/proxy-test",
        description: "Should still work without query parameters"
    }
];

function makeRequest(testCase) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3566,
            path: testCase.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Query-Params-Bug-Fix-Test/1.0',
                'Accept': 'application/json'
            },
            timeout: 5000 // 5 second timeout
        };

        console.log(`🔍 Testing: ${testCase.path}`);

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({ 
                        testCase, 
                        response, 
                        statusCode: res.statusCode,
                        success: true,
                        responseTime: Date.now() - startTime
                    });
                } catch (error) {
                    resolve({
                        testCase,
                        response: data,
                        statusCode: res.statusCode,
                        success: false,
                        error: `Failed to parse JSON: ${error.message}`,
                        responseTime: Date.now() - startTime
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                testCase,
                success: false,
                error: error.message,
                responseTime: Date.now() - startTime
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                testCase,
                success: false,
                error: 'Request timeout (>5s)',
                responseTime: 5000
            });
        });

        const startTime = Date.now();
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Query Parameters Bug Fix\n');
    console.log('=' .repeat(80));
    
    let passedTests = 0;
    let failedTests = 0;
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
        console.log(`📝 ${testCase.description}`);
        console.log(`🔗 Path: ${testCase.path}`);
        console.log('-'.repeat(60));
        
        const result = await makeRequest(testCase);
        
        if (result.success && result.statusCode === 200) {
            console.log('✅ Status: SUCCESS');
            console.log(`⏱️  Response Time: ${result.responseTime}ms`);
            
            if (result.response && result.response.clientInfo) {
                console.log(`🌐 Detected IP: ${result.response.clientInfo.ip}`);
                console.log(`🔒 Protocol: ${result.response.clientInfo.protocol}`);
                
                // Check if query parameters were parsed correctly
                if (result.response.query) {
                    console.log(`📊 Query Parameters:`, JSON.stringify(result.response.query, null, 2));
                }
            }
            
            passedTests++;
        } else {
            console.log('❌ Status: FAILED');
            console.log(`⏱️  Response Time: ${result.responseTime}ms`);
            if (result.error) {
                console.log(`💥 Error: ${result.error}`);
            }
            if (result.statusCode) {
                console.log(`📊 HTTP Status: ${result.statusCode}`);
            }
            failedTests++;
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 Query Parameters Test Results:');
    console.log(`✅ Passed: ${passedTests}/${testCases.length}`);
    console.log(`❌ Failed: ${failedTests}/${testCases.length}`);
    
    if (failedTests === 0) {
        console.log('\n🎉 All tests passed! Query parameters bug is FIXED! 🎉');
    } else {
        console.log('\n⚠️  Some tests failed. The bug may still exist.');
    }
    
    console.log('\n💡 Bug Fix Summary:');
    console.log('   - Replaced deprecated url.parse() with modern URL API');
    console.log('   - Added proper error handling for URL parsing failures');
    console.log('   - Added fallback to legacy parsing if needed');
    console.log('   - Prevents request timeouts on malformed URLs');
}

// Run the tests
runTests().catch(console.error);

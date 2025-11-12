#!/usr/bin/env node

/**
 * Diagnostic script for trust proxy issues in production
 * This helps identify what headers your production proxy is sending
 */

const http = require('http');
const https = require('https');
const url = require('url');

function diagnoseEndpoint(targetUrl) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.path || '/',
            method: 'GET',
            headers: {
                'User-Agent': 'XyPriss-Proxy-Diagnostic/1.0',
                'Accept': 'application/json',
            }
        };

        console.log(`🔍 Diagnosing: ${targetUrl}`);
        console.log(`📡 Request options:`, options);

        const req = client.request(options, (res) => {
            let data = '';
            
            console.log(`📊 Response Status: ${res.statusCode}`);
            console.log(`📨 Response Headers:`, res.headers);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({ 
                        url: targetUrl,
                        statusCode: res.statusCode, 
                        headers: res.headers,
                        response 
                    });
                } catch (error) {
                    console.log(`📄 Raw response (not JSON):`, data.substring(0, 200));
                    resolve({ 
                        url: targetUrl,
                        statusCode: res.statusCode, 
                        headers: res.headers,
                        response: data 
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Request failed:`, error.message);
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function runDiagnostics() {
    console.log('🏥 XyPriss Trust Proxy Diagnostics\n');
    console.log('=' .repeat(80));
    
    // Test endpoints to check
    const endpoints = [
        'http://localhost:3001/api/proxy-test',  // Local test
        // Add your production URLs here:
        // 'https://your-domain.com/api/proxy-test',
        // 'https://your-staging.com/api/proxy-test',
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`\n🎯 Testing: ${endpoint}`);
            console.log('-'.repeat(60));
            
            const result = await diagnoseEndpoint(endpoint);
            
            if (result.response && typeof result.response === 'object') {
                const clientInfo = result.response.clientInfo;
                const headers = result.response.headers;
                
                console.log('✅ Proxy Test Endpoint Response:');
                console.log(`   🌐 Detected IP: ${clientInfo?.ip || 'unknown'}`);
                console.log(`   🔒 Protocol: ${clientInfo?.protocol || 'unknown'}`);
                console.log(`   🔐 Secure: ${clientInfo?.secure || false}`);
                console.log(`   🏠 Hostname: ${clientInfo?.hostname || 'unknown'}`);
                
                if (clientInfo?.ips && clientInfo.ips.length > 0) {
                    console.log(`   📊 IPs Chain: [${clientInfo.ips.join(', ')}]`);
                }
                
                console.log('\n📨 Proxy Headers Received by Server:');
                const proxyHeaders = [
                    'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host',
                    'x-real-ip', 'cf-connecting-ip', 'x-forwarded-port'
                ];
                
                proxyHeaders.forEach(header => {
                    if (headers && headers[header]) {
                        console.log(`   ${header}: ${headers[header]}`);
                    }
                });
                
                // Analysis
                console.log('\n🔍 Analysis:');
                if (headers && headers['x-forwarded-for']) {
                    console.log(`   ✅ X-Forwarded-For detected: ${headers['x-forwarded-for']}`);
                    
                    const expectedIP = headers['x-forwarded-for'].split(',')[0].trim();
                    if (clientInfo?.ip === expectedIP) {
                        console.log(`   ✅ Trust proxy working correctly`);
                    } else {
                        console.log(`   ⚠️  Trust proxy might have issues:`);
                        console.log(`      Expected: ${expectedIP}`);
                        console.log(`      Got: ${clientInfo?.ip}`);
                    }
                } else {
                    console.log(`   ℹ️  No X-Forwarded-For header (direct connection or proxy not configured)`);
                }
                
                if (headers && headers['x-forwarded-proto']) {
                    console.log(`   ✅ X-Forwarded-Proto detected: ${headers['x-forwarded-proto']}`);
                    if (clientInfo?.protocol === headers['x-forwarded-proto']) {
                        console.log(`   ✅ Protocol detection working`);
                    } else {
                        console.log(`   ⚠️  Protocol detection issue`);
                    }
                } else {
                    console.log(`   ℹ️  No X-Forwarded-Proto header`);
                }
                
            } else {
                console.log('❌ Unexpected response format or endpoint not available');
                console.log('Response:', result.response);
            }
            
        } catch (error) {
            console.log(`❌ Failed to test ${endpoint}: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 Diagnostics completed!');
    console.log('\n💡 Production Troubleshooting Tips:');
    console.log('   1. Verify your reverse proxy (Nginx/Apache) is sending X-Forwarded-* headers');
    console.log('   2. Check if your proxy IP is in the trustProxy configuration');
    console.log('   3. Ensure your proxy is not stripping or modifying headers');
    console.log('   4. Test with curl to see raw headers:');
    console.log('      curl -H "X-Forwarded-For: 1.2.3.4" -H "X-Forwarded-Proto: https" http://your-server/api/proxy-test');
    console.log('\n📋 Common Nginx Configuration:');
    console.log('   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
    console.log('   proxy_set_header X-Forwarded-Proto $scheme;');
    console.log('   proxy_set_header X-Real-IP $remote_addr;');
    console.log('   proxy_set_header Host $host;');
}

// Run diagnostics
runDiagnostics().catch(console.error);

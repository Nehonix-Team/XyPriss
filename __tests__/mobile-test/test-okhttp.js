const axios = require('axios');

// Test specifically okhttp User-Agent
async function testOkHttp() {
    const baseURL = 'http://localhost:3001';

    console.log('🧪 Testing OkHttp User-Agent Detection\n');

    const testCases = [
        {
            name: 'OkHttp (Android)',
            userAgent: 'okhttp/4.12.0',
            expected: 'allowed'
        },
        {
            name: 'OkHttp with Android',
            userAgent: 'okhttp/4.12.0 Android',
            expected: 'allowed'
        },
        {
            name: 'Dalvik (Android runtime)',
            userAgent: 'Dalvik/2.1.0 (Linux; U; Android 11; SM-G998B Build/RP1A.200720.012)',
            expected: 'allowed'
        },
        {
            name: 'CFNetwork (iOS)',
            userAgent: 'CFNetwork/1327.0.4 Darwin/21.2.0',
            expected: 'allowed'
        }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`📱 Testing: ${testCase.name}`);
            console.log(`   User-Agent: ${testCase.userAgent}`);

            const response = await axios.get(baseURL, {
                headers: {
                    'User-Agent': testCase.userAgent
                },
                timeout: 5000
            });

            console.log(`   ✅ Status: ${response.status} - ALLOWED`);
            console.log(`   📄 Response: ${JSON.stringify(response.data).substring(0, 100)}...`);

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                if (status === 403 && data.code === 'MOBILE_ONLY') {
                    console.log(`   ❌ Status: ${status} - BLOCKED (Mobile-only)`);
                    console.log(`   📄 Message: ${data.message}`);
                } else {
                    console.log(`   ⚠️  Status: ${status} - Unexpected error`);
                    console.log(`   📄 Response: ${JSON.stringify(data)}`);
                }
            } else {
                console.log(`   🚫 Error: ${error.message}`);
            }
        }

        console.log(''); // Empty line between tests
    }

    console.log('🎉 OkHttp testing completed!');
}

// Run the test
testOkHttp().catch(console.error);
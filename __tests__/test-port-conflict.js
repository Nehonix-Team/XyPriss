// Test to verify port conflict error handling
import { createServer } from "./src/index.ts";

console.log('🧪 Testing port conflict error handling...');

async function testPortConflict() {
    // Create first server
    const app1 = createServer({
        logging: {
            enabled: false, // Reduce noise
        },
    });

    app1.get('/', (req, res) => {
        res.json({ message: 'Server 1' });
    });

    try {
        // Start first server on port 8888
        console.log('Starting first server on port 8888...');
        await app1.start(8888);
        console.log('✅ First server started successfully');

        // Create second server (without autoPortSwitch)
        const app2 = createServer({
            logging: {
                enabled: false,
            },
            // No autoPortSwitch - should be disabled by default
        });

        app2.get('/', (req, res) => {
            res.json({ message: 'Server 2' });
        });

        try {
            // Try to start second server on the same port
            console.log('Trying to start second server on the same port 8888...');
            await app2.start(8888);
            console.log('❌ Second server started unexpectedly - this should have failed!');
            process.exit(1);
        } catch (error) {
            console.log('✅ Second server failed to start as expected');
            console.log('Error message:', error.message);
            
            // Check if the error message is what we expect
            if (error.message.includes('Port 8888 is already in use') && 
                error.message.includes('Enable autoPortSwitch')) {
                console.log('✅ Port conflict error handling works correctly!');
                process.exit(0);
            } else {
                console.log('❌ Unexpected error message format');
                console.log('Expected: Message containing "Port 8888 is already in use" and "Enable autoPortSwitch"');
                console.log('Actual:', error.message);
                process.exit(1);
            }
        }
    } catch (error) {
        console.log('❌ Failed to start first server:', error.message);
        process.exit(1);
    }
}

testPortConflict();

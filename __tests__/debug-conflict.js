// Debug port conflict in detail
import { createServer } from "./src/index.ts";

console.log('🔍 Debugging port conflict in detail...');

async function debugConflict() {
    // Create first server
    const app1 = createServer({
        logging: { enabled: true, level: "info" },
    });

    app1.get('/', (req, res) => {
        res.json({ message: 'Server 1', port: app1.getPort() });
    });

    try {
        console.log('Starting first server on port 6666...');
        await app1.start(6666);
        console.log('✅ First server started');
        console.log('First server actual port:', app1.getPort());

        // Test first server
        const proc1 = Bun.spawn(['curl', '-s', 'http://localhost:6666/'], {
            stdout: 'pipe'
        });
        const output1 = await new Response(proc1.stdout).text();
        console.log('First server response:', output1);

        // Create second server
        const app2 = createServer({
            logging: { enabled: true, level: "info" },
            // Explicitly disable autoPortSwitch
            server: {
                autoPortSwitch: {
                    enabled: false
                }
            }
        });

        app2.get('/', (req, res) => {
            res.json({ message: 'Server 2', port: app2.getPort() });
        });

        try {
            console.log('Trying to start second server on port 6666...');
            await app2.start(6666);
            console.log('❌ Second server started unexpectedly!');
            console.log('Second server actual port:', app2.getPort());

            // Test second server
            const proc2 = Bun.spawn(['curl', '-s', 'http://localhost:6666/'], {
                stdout: 'pipe'
            });
            const output2 = await new Response(proc2.stdout).text();
            console.log('Second server response:', output2);

            process.exit(1);
        } catch (error) {
            console.log('✅ Second server failed as expected');
            console.log('Error:', error.message);
            process.exit(0);
        }
    } catch (error) {
        console.log('❌ Error with first server:', error.message);
        process.exit(1);
    }
}

debugConflict();

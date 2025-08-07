// Debug port binding
import { createServer } from "./src/index.ts";

console.log('🔍 Debugging port binding...');

async function debugPort() {
    const app = createServer({
        logging: { enabled: false },
    }); 

    app.get('/', (req, res) => {
        res.json({ message: 'Test server' });
    });

    try {
        console.log('Starting server on port 7777...');
        await app.start(7777);
        console.log('✅ Server started on port 7777');

        // Test with curl to see if server is actually listening
        console.log('Testing with curl...');
        
        // Use Bun's subprocess to test the connection
        const proc = Bun.spawn(['curl', '-s', 'http://localhost:7777/'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });

        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        console.log('Curl exit code:', exitCode);
        console.log('Curl output:', output);

        if (exitCode === 0) {
            console.log('✅ Server is responding on localhost:7777');
        } else {
            console.log('❌ Server is not responding on localhost:7777');
        }

        // Test with 127.0.0.1
        const proc2 = Bun.spawn(['curl', '-s', 'http://127.0.0.1:7777/'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });

        const output2 = await new Response(proc2.stdout).text();
        const exitCode2 = await proc2.exited;

        console.log('Curl 127.0.0.1 exit code:', exitCode2);
        console.log('Curl 127.0.0.1 output:', output2);

        if (exitCode2 === 0) {
            console.log('✅ Server is responding on 127.0.0.1:7777');
        } else {
            console.log('❌ Server is not responding on 127.0.0.1:7777');
        }

        process.exit(0);
    } catch (error) {
        console.log('❌ Error:', error.message);
        process.exit(1);
    }
}

debugPort();

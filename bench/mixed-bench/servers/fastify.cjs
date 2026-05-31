const fastify = require('fastify')({ logger: false });
const path = require('path');
const fs = require('fs');

const ASSET_PATH = path.resolve(__dirname, '../assets/dummy-500k.bin');

// Simulate auth hook (2ms delay)
fastify.addHook('preHandler', async (request, reply) => {
    await new Promise(r => setTimeout(r, 2));
    request.user = { id: 1, role: 'admin' };
});

fastify.get('/api/download', async (request, reply) => {
    // Send 500KB file
    const stream = fs.createReadStream(ASSET_PATH);
    return reply.type('application/octet-stream').send(stream);
});

const PORT = 8092;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Fastify listening on http://0.0.0.0:${PORT}`);
});

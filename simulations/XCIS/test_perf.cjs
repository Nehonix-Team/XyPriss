const net = require('net');
const client = net.createConnection('.xsys/xhsc.sock');
client.on('connect', () => {
    console.time('req');
    const msg = JSON.stringify({
        type: "RegisterWorker",
        payload: { id: "perf-test" }
    });
    const payload = Buffer.from(msg);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(payload.length, 0);
    client.write(Buffer.concat([size, payload]));
});
client.on('data', (d) => {
    console.timeEnd('req');
    process.exit();
});

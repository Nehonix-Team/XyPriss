const net = require('net');
const client = net.createConnection('.xsys/xhsc.sock');
client.on('connect', () => {
    console.time('ping');
    const msg = JSON.stringify({
        type: "Ping",
        payload: {}
    });
    const payload = Buffer.from(msg);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(payload.length, 0);
    client.write(Buffer.concat([size, payload]));
});
client.on('data', (d) => {
    console.timeEnd('ping');
    process.exit();
});

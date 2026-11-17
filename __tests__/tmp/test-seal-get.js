import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const sDir = process.env.XYPRISS_USER_TMP;
const xhsc = path.join(process.cwd(), 'node_modules', 'xypriss', 'bin', 'xhsc.exe');

const p = spawn(xhsc, ['daemon', process.cwd()], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
});

p.stdout.on('data', d => console.log('DAEMON STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('DAEMON STDERR:', d.toString()));
p.on('exit', (c, s) => console.log('DAEMON EXIT:', c, s));

await new Promise(r => setTimeout(r, 1200));

const sock = path.join(sDir, 'synapx.sock');
const token = fs.readFileSync(path.join(sDir, '.auth_token'), 'utf8').trim();
const hash = path.basename(sDir);
const sealKey = "abcdef0123456789abcdef0123456789";

const client = net.createConnection(sock, () => {
    console.log('Sending handshake...');
    const hs = Buffer.from(JSON.stringify({ sessionHash: hash, token: token, clientPid: process.pid }));
    const h = Buffer.alloc(6);
    h.writeUInt8(0x53, 0);
    h.writeUInt8(0x01, 1);
    h.writeUInt32BE(hs.length, 2);
    client.write(Buffer.concat([h, hs]));
});

let buf = Buffer.alloc(0);
let step = 0;

client.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 6) {
        const type = buf.readUInt8(1);
        const len = buf.readUInt32BE(2);
        if (buf.length < 6 + len) return;
        const payload = buf.subarray(6, 6 + len);
        buf = buf.subarray(6 + len);

        if (step === 0) {
            console.log('Handshake response:', payload.toString());
            step = 1;
            console.log('Sending env.seal with PID:', process.pid);
            const call = Buffer.from(JSON.stringify({
                id: 1,
                mod: 'env',
                action: 'seal',
                args: [sealKey],
                opts: { __seal__: sealKey, pid: process.pid }
            }));
            const h = Buffer.alloc(6);
            h.writeUInt8(0x53, 0);
            h.writeUInt8(0x03, 1);
            h.writeUInt32BE(call.length, 2);
            client.write(Buffer.concat([h, call]));
        } else if (step === 1) {
            console.log('Seal response:', payload.toString());
            step = 2;
            console.log('Sending env.get with PID:', process.pid);
            const call = Buffer.from(JSON.stringify({
                id: 2,
                mod: 'env',
                action: 'get',
                args: ['PORT'],
                opts: { __seal__: sealKey, pid: process.pid, root: process.cwd() }
            }));
            const h = Buffer.alloc(6);
            h.writeUInt8(0x53, 0);
            h.writeUInt8(0x03, 1);
            h.writeUInt32BE(call.length, 2);
            client.write(Buffer.concat([h, call]));
        } else if (step === 2) {
            console.log('Get response:', payload.toString());
            client.end();
            p.kill();
            process.exit(0);
        }
    }
});

setTimeout(() => {
    console.log('Timeout');
    p.kill();
    process.exit(1);
}, 4000);


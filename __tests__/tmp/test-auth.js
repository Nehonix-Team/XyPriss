import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const sDir = process.env.XYPRISS_USER_TMP;
console.log('Session Dir:', sDir);

const xhsc = path.join(process.cwd(), 'node_modules', 'xypriss', 'bin', 'xhsc.exe');

const p = spawn(xhsc, ['daemon', process.cwd()], {
    env: { ...process.env },
    stdio: 'pipe'
});

p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));
p.on('error', err => console.log('SPAWN ERROR:', err));
p.on('exit', (code, sig) => console.log('EXIT EVENT:', code, sig));

for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    const sock = path.join(sDir, 'synapx.sock');
    const exists = fs.existsSync(sock);
    if (exists) {
        console.log(`synapx.sock appeared at ${i * 200}ms!`);
        break;
    }
    if (i % 5 === 0) {
        console.log(`[${i * 200}ms] files:`, fs.readdirSync(sDir));
    }
}

p.kill();

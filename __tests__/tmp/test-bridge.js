import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SynapxSyncBridge } from './node_modules/xypriss/dist/esm/index.js'; // or from internal

const sDir = process.env.XYPRISS_USER_TMP;
const xhsc = path.join(process.cwd(), 'node_modules', 'xypriss', 'bin', 'xhsc.exe');

const p = spawn(xhsc, ['daemon', process.cwd()], {
    env: { ...process.env },
    stdio: 'ignore'
});

await new Promise(r => setTimeout(r, 1200));

const sock = path.join(sDir, 'synapx.sock');
const tokenFile = path.join(sDir, '.auth_token');
const token = fs.readFileSync(tokenFile, 'utf8').trim();
const hash = path.basename(sDir);

console.log('Testing SynapxSyncBridge with:', sock);
// Let's test importing SynapxClient directly
EOF


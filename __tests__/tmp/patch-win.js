import fs from 'node:fs';
import path from 'node:path';

const filePath = 'C:/Users/ETS GOFAGA/Documents/iDevo/tmp/my-xypriss-app/node_modules/xypriss/dist/esm/index.js';
let content = fs.readFileSync(filePath, 'utf8');

const isAvRegex = /isAvailable\(\)\s*\{[\s\S]*?return fs\.existsSync\(this\.socketPath\);[\s\S]*?\}/;
content = content.replace(isAvRegex, `isAvailable() {
        if (!this.socketPath) return false;
        try { if (fs.existsSync(this.socketPath)) return true; } catch {}
        if (process.platform === "win32") {
            try {
                const dir = path.dirname(this.socketPath);
                const base = path.basename(this.socketPath);
                return fs.readdirSync(dir).includes(base);
            } catch {}
        }
        return false;
    }`);

content = content.replaceAll('!fs.existsSync(this.socketPath)', '!this.isAvailable()');

fs.writeFileSync(filePath, content);
console.log('Successfully patched index.js!');
console.log('Includes readdirSync:', content.includes('readdirSync'));
console.log('Remaining existsSync socketPath:', content.includes('fs.existsSync(this.socketPath)'));


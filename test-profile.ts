import { __sys__ } from "./src/index";
import { getVerifiedCallerInfo } from "./src/utils/ProjectDiscovery";
import { SynapxClient } from "./src/xhsc/synapx/SynapxClient";

let t0 = process.hrtime.bigint();
for (let i = 0; i < 100; i++) {
    getVerifiedCallerInfo();
}
let t1 = process.hrtime.bigint();
console.log(`getVerifiedCallerInfo (100x): ${(Number(t1 - t0) / 1_000_000).toFixed(2)} ms`);

const synapx = SynapxClient.getInstance();
t0 = process.hrtime.bigint();
for (let i = 0; i < 100; i++) {
    synapx.callSync("env", "get", ["PORT"], { __seal__: (synapx as any).sessionHash, pid: process.pid });
}
t1 = process.hrtime.bigint();
console.log(`synapx.callSync (100x): ${(Number(t1 - t0) / 1_000_000).toFixed(2)} ms`);

process.exit(0);

import { createServer, NetworkStats, XyPrissSys } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

console.log("sys: ", (__sys__ as XyPrissSys).$check("/src/index.ts")); // Fails: 'src' is a directory

// Checking file status

// List all IPs
const net = __sys__.$network() as NetworkStats;
console.log("net: ", net);
net.interfaces.forEach((i) => {
    console.log(`Interface: ${i.name}, IPs: ${i.ip_addresses.join(", ")}`);
});

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();




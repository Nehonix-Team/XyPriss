import { createServer, NetworkStats, ProcessInfo, XyPrissSys, } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

// Identifying the heaviest CPU task
const hogs = __sys__.$processes({ topCpu: 1 }) as ProcessInfo[];
if (hogs.length) {
    console.log(`Top CPU: ${hogs[0].name} (${hogs[0].cpu_usage}%)`);
}
app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();





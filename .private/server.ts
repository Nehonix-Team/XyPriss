import {
    createServer,
    NetworkStats,
    ProcessInfo,
    XyPrissSys,
} from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

// Identifying the heaviest CPU task
const hogs = __sys__.$move("test-cors.js", "__tests__/test-cors.js");

console.log(hogs);

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


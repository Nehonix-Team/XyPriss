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
const hogs = __sys__.$verify("notes.v2.json", "v2I'm a file that as been created auto by a xypriss util - J'ai été auto créé par un util xypriss");

console.log(hogs);

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


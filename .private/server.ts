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

__sys__.$wap(
    "/home/idevo/Documents/projects/XyPriss/.private/server.ts",
    () => {
        console.log("Activity period ended. Analyzing logs...");
    },
    { duration: 60 }  
);

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


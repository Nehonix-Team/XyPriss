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

// Demo the new Advanced Content Watcher (Content monitoring with Diff)
console.log("\n=== Advanced Content Monitoring Demo ===");
console.log("Watching server.ts for content changes (15s)...");
console.log("(Tip: Add or remove characters in this file and save)");

__sys__.$wc("/home/idevo/Documents/projects/XyPriss/.private/server.ts", {
    duration: 300,
    diff: true,
});

// console.log("\n=== Standard Watch & Process Demo ===");
// __sys__.$wap(
//     ".",
//     () => {
//         console.log("Standard cycle complete.");
//     },
//     { duration: 5 }
// );

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


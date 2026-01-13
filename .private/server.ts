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
console.log("\n=== Advanced Parallel Content Monitoring Demo ===");
console.log("Watching server.ts AND Cargo.toml for content changes (300s)...");
console.log("(Tip: Add or remove characters in these files and save)");


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
    res.xJson({ message: "Hello " });
});

app.start();


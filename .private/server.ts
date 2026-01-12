import { createServer, XyPrissSys } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

console.log("sys: ", (__sys__ as XyPrissSys).$check("/src/index.ts")); // Fails: 'src' is a directory

// Checking file status

console.log("disk: ", __sys__.$disks("/"));

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();



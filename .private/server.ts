import { createServer, XyPrissSys } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

console.log("sys: ", (__sys__ as XyPrissSys).$check("/src/index.ts")); // Fails: 'src' is a directory

// Checking file status
const status = __sys__.$check("package.json");
console.log(`File exists: ${status.exists}`);
console.log(`File readable: ${status.readable}`);
console.log(`File writable: ${status.writable}`);

const info = (__sys__ as XyPrissSys).$info();
console.log("sys info: ", info);



app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();




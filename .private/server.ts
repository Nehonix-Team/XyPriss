import { createServer, XyPrissSys } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

console.log("sys: ", (__sys__ as XyPrissSys).$check("/src/index.ts")); // Fails: 'src' is a directory

// Checking file status
const info = (__sys__ as XyPrissSys).$info();
console.log("sys info: ", info);

console.log((__sys__ as XyPrissSys).$chmod("package.json", "755"));

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


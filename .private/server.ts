import { createServer, XyPrissSys } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

console.log("sys: ", (__sys__ as XyPrissSys).$memory); // Fails: 'src' is a directory


app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


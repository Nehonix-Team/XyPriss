import { createServer } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
});

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();


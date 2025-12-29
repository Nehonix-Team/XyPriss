import { createServer } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
    plugins: {
        register: [],
    },
});

app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

app.start();


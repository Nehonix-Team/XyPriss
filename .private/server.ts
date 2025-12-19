import { createServer } from "../src";

const app = createServer({
    server: {
        port: __sys__.__PORT,
    },
});

app.start();


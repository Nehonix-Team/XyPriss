import { createServer, XStatic } from "xypriss";

const app = createServer({ plugins: {} });

// Instantiate the manager with application and system context
const xs = new XStatic(app, __sys__);

// Define a static route
xs.define("/static", "public");

app.get("/ping", (req, res) => {
    res.send("pong");
});

app.start();


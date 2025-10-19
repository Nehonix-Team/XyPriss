import { createServer, Router } from "../../src";
import { XyPriss_Config } from "./config";
import router from "./src/router";

const app = createServer(XyPriss_Config);

// Security middleware is now configured via XyPriss_Config.security
// No need for manual middleware configuration

app.get("/", (req, res) => {
    res.send("Hello World");
});

app.use("/api", router);

app.start();


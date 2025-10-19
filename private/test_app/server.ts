import { createServer, Router } from "../../src";
import { XyPriss_Config } from "./config";
import { securityMdlw } from "./src/midlewares/scrt.mld";
import router from "./src/router";

const app = createServer(XyPriss_Config);

// Security middleware is now configured via XyPriss_Config.security
// No need for manual middleware configuration
securityMdlw(app)
app.get("/", (req, res) => {
    res.send("Hello World");
});

app.use("/api", router);

app.start();


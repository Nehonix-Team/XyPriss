import { createServer, XyPrissSys } from "../src";
import { testSConfigs2 } from "./configs";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer(testSConfigs2);

app.delete("/user", (req, res) => {
    const { id } = req.body;
    console.log("Deleting ... ");
    console.log("Request body: ", req.body);
    console.log("Request params: ", req.params);
    if (!id) {
        res.status(400).send("User id is required");
        return;
    }
    res.send(`User with id ${id} has been deleted`);
});

(__sys__ as XyPrissSys).$tar(
    "/home/idevo/Documents/projects/XyPriss/tools/XyPCLI/templates",
    "/home/idevo/Documents/projects/XyPriss/tools/XyPCLI/initdr.zip",
);

app.trace("/tunnel", (req, res) => {
    console.log("[CONNECT] Request received for tunnel");
    console.log("[CONNECT] URL:", req.url);
    res.writeHead(200, {
        "X-Tunnel-Status": "Simulated",
    });
    res.end();
});

app.all("/test", (req, res) => {
    res.send("Finished.");
});

//
app.start();


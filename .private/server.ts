import { createServer } from "../src";
import { productionCSP } from "./productionCsp";

// Créez d'abord la configuration
// console.log("initial configs: ", __cfg__.get("notFound"));

// Gelez toute la configuration avant de la passer
const app = createServer(
    __const__.$cfg({
        notFound: {
            // enabled: false,
            // message: "test of notfound message",
        },
        security: {
            enabled: true,
        },
    })
);
// console.log("final configs: ", __cfg__.get("notFound"));

app.get("/", (req, res) => {
    res.xJson({
        message: "Hello from XyPrissJS!",
        version: "1.0.0",
        performance: "⚡ Optimized",
    });
});

//
app.start(undefined, async () => {
    await app.waitForReady();
    // app.redirectFromPort(8080, 3000);
});


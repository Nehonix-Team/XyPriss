import { createServer } from "../src";

// Créez d'abord la configuration
console.log("initial configs: ", __cfg__.get("notFound"));

// Gelez toute la configuration avant de la passer
const app = createServer(
    __const__.$cfg({
        notFound: {
            message: "test of notfound message",
        },
        security: {
            rateLimit: {
                max: 7,
                legacyHeaders: true,
                message: "this is a test rtlm msg",
            },
        },
    })
);
console.log("final configs: ", __cfg__.get("notFound"));

//
app.start();


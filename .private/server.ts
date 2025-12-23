import { createServer } from "../src";

// Créez d'abord la configuration
console.log("initial configs: ", __cfg__.get("notFound"));

// Gelez toute la configuration avant de la passer
const app = createServer(
    __const__.$make({
        notFound: {
            message: "this is a test not found msg",
            notExistProp: "property doesn't exist",
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

const normal = createServer({
    notFound: {
        message: "this is a test not found msg",
        notExistProp: "property doesn't exist",
    },
    security: {
        rateLimit: {
            max: 7,
            legacyHeaders: true,
            message: "this is a test rtlm msg",
        },
    },
});
console.log("final configs: ", __cfg__.get("notFound"));

//
app.start();


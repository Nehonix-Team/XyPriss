import { createServer } from "../src";
import { testSConfigs2 } from "./configs";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer(testSConfigs2);

console.log(
    "===========================updating app from 'server2.ts'================="
);

__cfg__.update("security", {
    rateLimit: {
        max: 10,
    },
});

//
app.start();


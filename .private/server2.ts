import { createServer, XyPrissSys, __sys__ } from "../src";
import { testSConfigs2 } from "./configs";
import router from "./router";
import { logger } from "./testPlugin_Logger";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer({});


app.start();
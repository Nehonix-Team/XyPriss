import { createServer, XyPrissSys, __sys__ } from "../src";
import { testSConfigs2 } from "./configs";
import router from "./router";
import { logger } from "./testPlugin_Logger";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "server1",
                port: 7627,
                host: "localhost",
                server: {
                    xems: {
                        persistence: {
                            enabled: true,
                            path: "secureStorage.xems",
                            secret: "c538b49160b30869eb9bd528a3faebeb",
                        },
                    },
                },
                plugins: {
                    register: [logger],
                },
                network: {
                    compression: {
                        algorithms: ["br", "gzip", "deflate", "zstd"],
                    },
                },
            },
        ],
    },
});

app.use("/api", router);

app.get("/main/base/route", (req, res) => {
    res.status(200).json({ message: "Main route" });
});

//
app.start();



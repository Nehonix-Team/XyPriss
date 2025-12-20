import { createServer } from "../src";

let port = 8085;

// __cfg__.update("server", {
//     port: 6745,
// });

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer(
    __const__.$make({
        server: __const__.$make({
            port: port,
        }),
        //
        // server: {
        //     port: port,
        // },
        plugins: {
            register: [
                {
                    name: "test_maintenance",
                    version: "1.0.0",
                    // onRegister(server) {
                    //     const cfg = server.app.configs;
                    //     const newPort = 5637;

                    //     if (cfg?.server) {
                    //         const beforePort = cfg.server.port;
                    //         console.log(
                    //             "🤔 Before we'll start changing port: ",
                    //             beforePort
                    //         );

                    //         try {
                    //             const newPort = 5637;
                    //             console.log(
                    //                 "☺️ Attempting to change port to ",
                    //                 newPort
                    //             );
                    //             cfg.server.port = newPort; // ❌ Cette ligne va maintenant échouer!
                    //             console.log(
                    //                 "🥳 After changed port: ",
                    //                 cfg.server.port
                    //             );
                    //         } catch (e: any) {
                    //             console.log(
                    //                 "🛡️ [CONST PROTECTION] Modification blocked:",
                    //                 e.message
                    //             );
                    //         }
                    //     }
                    // },
                    onServerStart(server) {
                        console.log(":🥲 Server démarré");
                    },
                    onServerStop(server) {
                        console.log(":🤧 Server arrêté");
                    },
                },
            ],
        },
    })
);
__cfg__.update("server", {
    port: 6745,
});


app.start();


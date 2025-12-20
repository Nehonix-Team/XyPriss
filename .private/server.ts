import { createServer } from "../src";

const app = createServer({
    plugins: {
        register: [
            {
                name: "test_maintenance",
                version: "1.0.0",
                onServerStart(server) {
                    console.log(":🥲 Server démarré");
                },
                onServerStop(server) {
                    console.log(":🤧 Server arrêté");
                },
            },
        ],
    },
});

__sys__.$add("author", "Nehonix");
__sys__.$add("version", "1.0.0");
console.log(__sys__.author);
console.log(__sys__.$isProduction());
console.log(__sys__.version);

app.start();


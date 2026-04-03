import { createServer } from "xypriss";
import { SwaggerPlugin } from "xypriss-swagger";
// import fs from "fs"

const server = createServer({
    server: {
        port: 3728,
    },
    pluginPermissions: [{
        name: "xypriss-swagger",
        allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"]
    }],
    // network: {connection},
    plugins: {
        register: [
            SwaggerPlugin({
                port: 9282,
            }),
        ],
    },
});
// console.log("fs testing: ", fs.readFileSync("package.json"))
console.log("project sys root: ", __sys__.__root__)

server.get("/", (_req, res) => {
    res.send("Hello World!");
});

server.start();


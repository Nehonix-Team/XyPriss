import { Plugin, XyPrissSys } from "xypriss";

export function plg() {
    return Plugin.create({
        name: "sm-es-plg",
        version: "1.0.0",
        description: "Small example plugin",
        onRegister(server, config) {
            const plg = (global as any).__sys__?.$plg;
            console.log("plg: ", plg?.$lsDirs("."));
            console.log("Small example plugin registered");
        },
    });
}


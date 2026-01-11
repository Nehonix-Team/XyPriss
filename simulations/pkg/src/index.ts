import { Plugin, XyPrissSys } from "xypriss";

export function plg() {
    const plg = (__sys__ as XyPrissSys).$plg

    console.log("plg: ", plg?.$lsDirs("."));


    return Plugin.create({
        name: "sm-es-plg",
        version: "1.0.0",
        description: "Small example plugin",
        onRegister(server, config) {
            console.log("Small example plugin registered");
        },
    });
}



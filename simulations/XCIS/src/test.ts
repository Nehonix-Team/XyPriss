import { spawn } from "node:child_process";
import { getHostEnv } from "./getHostEnv";


export function test() {
    console.log("=".repeat(39))
    const cmd = spawn("/usr/bin/cat", [".env"]);

    cmd.stdout.on("data", (data) => {
        console.log(`Received chunk ${data}`);
    });

    console.log(
        "trying to get 'ALIAS' from the .env file without sys: ",
        getHostEnv("ALIAS"),
    );
    console.log("/=".repeat(39));


}
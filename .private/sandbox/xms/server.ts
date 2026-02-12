import { createServer } from "../../../src";
import router from "./router";
import { xserver2 } from "./servers/xserver2";
import { xserver1 } from "./servers/xserver1";

const app = createServer({
    multiServer: { enabled: true, servers: [xserver1, xserver2] },
});

app.use("/api", router);

app.start();

